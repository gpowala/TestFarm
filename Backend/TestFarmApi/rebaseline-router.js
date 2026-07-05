const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const express = require('express');
const router = express.Router();

const _7z = require('7zip-min');
const unpack7z = util.promisify(_7z.unpack);

const { appSettings } = require('./appsettings');
const { Test, TestRun, TestResult, TestResultDiff, Repository } = require('./database');

// Diff statuses that represent a mismatch whose ".new" artifact should replace the ".gold" baseline.
// ("no new file" is intentionally excluded - there is nothing to promote in that case.)
const REBASELINABLE_DIFF_STATUSES = new Set(['failed', 'no gold file', 'files differ in size more than 10MB']);

// The executor archives the work dir with paths relative to $__TF_WORK_DIR__ (see
// Agents/Executor/test_farm_windows_service.py: archive_and_upload_temp_dir). A diff's "new" path is
// authored as e.g. "$__TF_WORK_DIR__/output/result.new"; inside the archive that file lives at
// "output/result.new". We can't know the real TF_WORK_DIR value here, so we strip the magic token.
const WORK_DIR_TOKEN = '$__TF_WORK_DIR__';

function archiveRelativePathForNew(diffNew) {
  const idx = diffNew.indexOf(WORK_DIR_TOKEN);
  if (idx === -1) {
    return null; // new file was written outside the work dir -> it is not inside the archive
  }
  const rel = diffNew.slice(idx + WORK_DIR_TOKEN.length).replace(/^[\\/]+/, '');
  return rel.length ? rel : null;
}

// Mirror the executor's diff naming so we can match a config DiffPair to its stored TestResultDiff row:
// diff_name = os.path.splitext(os.path.basename(diff.gold))[0]
function diffNameFromGold(gold) {
  const base = gold.replace(/\\/g, '/').split('/').pop();
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { stdio: 'pipe', encoding: 'utf8' });
}

function rmDir(dir) {
  if (dir && fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to remove directory ${dir}: ${e.message}`);
    }
  }
}

router.post('/rebaseline', async (req, res) => {
  const { TestResultIds, User } = req.body || {};

  // Stream progress as newline-delimited JSON so the frontend can render live per-test feedback.
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (event) => res.write(JSON.stringify(event) + '\n');

  const authorName = (User && User.Username) ? User.Username : 'TestFarm User';
  const authorEmail = (User && User.Email) ? User.Email : 'testfarm@local';

  let cloneDir = null;
  const extractDirs = [];

  try {
    if (!Array.isArray(TestResultIds) || TestResultIds.length === 0) {
      send({ type: 'error', message: 'No tests were selected for rebaseline.' });
      return;
    }

    const results = await TestResult.findAll({
      where: { Id: TestResultIds },
      include: [
        { model: Test, as: 'Test' },
        { model: TestResultDiff, as: 'TestsResultsDiffs', required: false }
      ]
    });

    if (results.length === 0) {
      send({ type: 'error', message: 'Selected test results were not found.' });
      return;
    }

    // A tests run targets a single repository, so every selected result shares it.
    const repositoryName = results[0].Test ? results[0].Test.RepositoryName : null;
    const testRunId = results[0].TestRunId;

    if (!repositoryName) {
      send({ type: 'error', message: 'Could not determine the repository for the selected tests.' });
      return;
    }

    const repository = await Repository.findOne({ where: { Name: repositoryName } });
    if (!repository) {
      send({ type: 'error', message: `Repository "${repositoryName}" does not exist.` });
      return;
    }

    send({ type: 'run-start', repositoryName, total: results.length });

    // Fresh full clone of the default branch so we have the gold files and can push.
    cloneDir = path.join(appSettings.storage.repositories, `rebaseline_${testRunId}_${Date.now()}`);
    const connectionString = `https://${repository.User}:${repository.Token}@${repository.Url.replace(/^https?:\/\//, '')}`;

    send({ type: 'clone', message: `Cloning ${repositoryName}...` });
    fs.mkdirSync(appSettings.storage.repositories, { recursive: true });
    execFileSync('git', ['clone', connectionString, cloneDir], { stdio: 'pipe' });
    // Author identity used for the rebaseline commit.
    git(cloneDir, ['config', 'user.name', authorName]);
    git(cloneDir, ['config', 'user.email', authorEmail]);

    let totalFilesStaged = 0;

    for (const result of results) {
      const test = result.Test;
      const testName = test ? test.Name : `TestResult ${result.Id}`;
      const testPath = test ? test.Path : null;

      send({ type: 'test-start', testResultId: result.Id, testName, testPath });

      // Passing tests need no rebaseline.
      if ((result.Status || '').toLowerCase() === 'passed') {
        send({ type: 'test-passed', testResultId: result.Id, testName });
        continue;
      }

      if (!testPath) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: 'Test has no repository path.' });
        continue;
      }

      // Read the test config to recover the exact gold/new diff pairs (the stored diff Name is lossy).
      const testConfigPath = path.join(cloneDir, testPath, 'test.testfarm');
      if (!fs.existsSync(testConfigPath)) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: 'test.testfarm not found in repository.' });
        continue;
      }

      let diffPairs = [];
      try {
        const testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
        diffPairs = Array.isArray(testConfig.diffs) ? testConfig.diffs : [];
      } catch (e) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: `Could not parse test.testfarm: ${e.message}` });
        continue;
      }

      if (diffPairs.length === 0) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: 'Test defines no diffs to rebaseline (likely an execution error).' });
        continue;
      }

      // Map recorded diff statuses by the executor's diff name.
      const diffStatusByName = {};
      for (const d of (result.TestsResultsDiffs || [])) {
        diffStatusByName[d.Name] = (d.Status || '').toLowerCase();
      }

      // Which pairs are failed diffs we should promote?
      const rebaselinablePairs = diffPairs.filter((pair) => {
        const status = diffStatusByName[diffNameFromGold(pair.gold)];
        return status && REBASELINABLE_DIFF_STATUSES.has(status);
      });

      if (rebaselinablePairs.length === 0) {
        const reason = (result.Status || '').toLowerCase() === 'error'
          ? 'Test errored - no comparison artifacts to rebaseline.'
          : 'No failed diffs with a new baseline to promote.';
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason });
        continue;
      }

      // Extract this result's archive to reach the ".new" files.
      const archivePath = path.join(appSettings.storage.resultsTempDirArchives, `${result.Id}.7z`);
      if (!fs.existsSync(archivePath)) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: 'Result archive is missing - nothing to extract.' });
        continue;
      }

      const extractDir = path.join(appSettings.storage.resultsTempDirArchives, `rebaseline_extract_${result.Id}_${Date.now()}`);
      extractDirs.push(extractDir);
      try {
        fs.mkdirSync(extractDir, { recursive: true });
        await unpack7z(archivePath, extractDir);
      } catch (e) {
        send({ type: 'test-nothing-to-rebaseline', testResultId: result.Id, testName, reason: `Failed to extract archive: ${e.message}` });
        continue;
      }

      const replaced = [];
      const skipped = [];
      for (const pair of rebaselinablePairs) {
        const diffName = diffNameFromGold(pair.gold);
        const relInArchive = archiveRelativePathForNew(pair.new);
        if (!relInArchive) {
          skipped.push({ diff: diffName, reason: 'new file is not inside the archive' });
          continue;
        }

        const newFileAbs = path.join(extractDir, ...relInArchive.split(/[\\/]/));
        if (!fs.existsSync(newFileAbs)) {
          skipped.push({ diff: diffName, reason: 'new file not present in archive' });
          continue;
        }

        const goldRelToRepo = path.join(testPath, ...pair.gold.split(/[\\/]/));
        const goldAbs = path.join(cloneDir, goldRelToRepo);
        fs.mkdirSync(path.dirname(goldAbs), { recursive: true });
        fs.copyFileSync(newFileAbs, goldAbs);

        // Stage using a forward-slash, repo-relative path.
        const gitPath = goldRelToRepo.split(path.sep).join('/');
        git(cloneDir, ['add', '--', gitPath]);

        replaced.push({ diff: diffName, goldPath: gitPath });
        send({ type: 'diff-replaced', testResultId: result.Id, testName, diff: diffName, goldPath: gitPath });
      }

      if (replaced.length > 0) {
        totalFilesStaged += replaced.length;
        send({ type: 'test-rebaselined', testResultId: result.Id, testName, replacedCount: replaced.length, replaced, skipped });
      } else {
        send({
          type: 'test-nothing-to-rebaseline',
          testResultId: result.Id,
          testName,
          reason: skipped.length ? 'Failed diffs had no promotable new files.' : 'No baseline changes were produced.'
        });
      }
    }

    if (totalFilesStaged === 0) {
      send({ type: 'complete', committed: false, filesChanged: 0, message: 'Nothing to rebaseline - no baseline files were changed.' });
      return;
    }

    const commitMessage = `Rebaseline ${totalFilesStaged} gold file(s) from tests run #${testRunId} by ${authorName}`;
    send({ type: 'commit', message: `Committing ${totalFilesStaged} file(s)...` });
    git(cloneDir, ['commit', '-m', commitMessage, '--author', `${authorName} <${authorEmail}>`]);

    send({ type: 'push', message: 'Pushing to repository...' });
    git(cloneDir, ['push']);

    send({ type: 'complete', committed: true, filesChanged: totalFilesStaged, message: `Pushed ${totalFilesStaged} rebaselined file(s) to ${repositoryName}.` });
  } catch (error) {
    console.error('Error during rebaseline:', error);
    const detail = (error.stderr && error.stderr.toString()) || error.message || String(error);
    send({ type: 'error', message: `Rebaseline failed: ${detail}` });
  } finally {
    rmDir(cloneDir);
    extractDirs.forEach(rmDir);
    res.end();
  }
});

module.exports = router;
