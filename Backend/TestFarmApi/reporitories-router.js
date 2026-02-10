const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sequelize, Grid, Host, Repository } = require('./database');
const { appSettings } = require('./appsettings');
const express = require('express');
const router = express.Router();

cloneSparseRepository = (repository, localRepositoryDir) => {
  if (!fs.existsSync(localRepositoryDir))
    fs.mkdirSync(localRepositoryDir, { recursive: true });

  let connectionString = `https://${repository.User}:${repository.Token}@${repository.Url.replace(/^https?:\/\//, '')}`;
  execSync(`git_clone_sparse.bat "${connectionString}" "${localRepositoryDir}" "testfarm"`, { stdio: 'pipe' });
}

requireFileExists = (filePath) => {
  if (!fs.existsSync(filePath))
    throw Error(`${filePath} file not found in repository`);
}

requireRepositoryExists = (repository) => {
  if (repository == null)
    throw Error('Repository does not exist');
}

findTestConfigFiles = (rootDir, currentDir = rootDir, results = []) => {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      findTestConfigFiles(rootDir, entryPath, results);
    } else if (entry.isFile() && entry.name === 'test.testfarm') {
      results.push(entryPath);
    }
  }

  return results;
}

findFilesByName = (rootDir, fileName, currentDir = rootDir, results = []) => {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      findFilesByName(rootDir, fileName, entryPath, results);
    } else if (entry.isFile() && entry.name === fileName) {
      results.push(entryPath);
    }
  }

  return results;
}

findTestsRootDirs = (rootDir) => {
  const rootFiles = findFilesByName(rootDir, 'tests.testfarm');
  return rootFiles.map(filePath => path.dirname(filePath));
}

/**
 * @swagger
 * /register-host:
 *   post:
 *     summary: Register a new host
 *     tags: [Hosts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - GridName
 *               - Type
 *               - Hostname
 *               - Cores
 *             properties:
 *               GridName:
 *                 type: string
 *               Type:
 *                 type: string
 *               Hostname:
 *                 type: string
 *               Cores:
 *                 type: integer
 *               RAM:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Host'
 *       500:
 *         description: Internal Server Error
 */
router.post('/add-repository', async (req, res) => {
    try {
      const { name, url, user, token } = req.body;
      console.log(req.body);
  
      let repository = await Repository.findOne({ where: { Name: name } });
      if (!repository) {
          repository = await Repository.create({
              Name: name,
              Url: url,
              User: user,
              Token: token,
              IsActive: true
          });
      }
      
      res.status(201).json(repository);
    } catch (error) {
      console.error('Error creating host:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  /**
   * @swagger
   * /unregister-host:
   *   get:
   *     summary: Unregister a host
   *     tags: [Hosts]
   *     parameters:
   *       - in: query
   *         name: Id
   *         required: true
   *         schema:
   *           type: integer
   *         description: The ID of the host to unregister
   *     responses:
   *       200:
   *         description: Host unregistered successfully
   *       404:
   *         description: Host not found
   *       500:
   *         description: Internal Server Error
   */
  router.get('/remove-repository', async (req, res) => {
    try {
      const { id } = req.query;
  
      const repository = await Repository.findByPk(id);
      if (!repository) {
        return res.status(404).json({ error: 'Repository not found' });
      } else {
        await repository.destroy();
        res.status(200).json({ message: 'Repository removed successfully' });
      }
      
    } catch (error) {
      console.error('Error removing repository:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  /**
   * @swagger
   * /update-host-status:
   *   put:
   *     summary: Update host status
   *     tags: [Hosts]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - Id
   *               - Status
   *             properties:
   *               Id:
   *                 type: integer
   *               Status:
   *                 type: string
   *     responses:
   *       200:
   *         description: Host status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Host'
   *       404:
   *         description: Host not found
   *       500:
   *         description: Internal Server Error
   */
  router.put('/update-repository', async (req, res) => {
    try {
      const { id, name, url, user, token } = req.body;
  
      const host = await Host.findByPk(Id);
      if (!host) {
        return res.status(404).json({ error: 'Host not found' });
      }
  
      host.Status = Status;
      host.LastUpdateTimestamp = new Date();
      await host.save();
  
      res.status(200).json({ message: 'Host status updated successfully', host });
    } catch (error) {
      console.error('Error updating host status:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  /**
   * @swagger
   * /grids:
   *   get:
   *     summary: Get all grids with related hosts data
   *     tags: [Grids]
   *     responses:
   *       200:
   *         description: Successfully retrieved grids with hosts
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/GridWithHosts'
   *       500:
   *         description: Internal Server Error
   */
  router.get('/repositories', async (req, res) => {
    try {
      const { name } = req.query;
      let whereClause = {};
      
      if (name) {
        whereClause.Name = name;
      }

      const repositories = await Repository.findAll({
        where: whereClause
      });
      res.status(200).json(repositories);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/repository-tests', async (req, res) => {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Repository name is required' });
    }

    const localRepositoryDir = `${appSettings.storage.repositories}/${name}`;

    try {
      let repository = await Repository.findOne({ where: { Name: name } });
      requireRepositoryExists(repository);

      cloneSparseRepository(repository, localRepositoryDir);

      const testsRootDirs = findTestsRootDirs(localRepositoryDir);
      if (testsRootDirs.length === 0) {
        throw Error('tests.testfarm file not found in repository');
      }

      const testsRootDir = testsRootDirs.sort()[0];
      const testConfigFiles = findTestConfigFiles(localRepositoryDir);
      const tests = [];

      for (const testConfigPath of testConfigFiles) {
        const testConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
        const relativePath = path
          .relative(testsRootDir, path.dirname(testConfigPath))
          .replace(/\\/g, '/');

        tests.push({
          name: testConfig.name,
          description: testConfig.description,
          owner: testConfig.owner,
          type: testConfig.type || 'native',
          relativePath: relativePath
        });
      }

      res.status(200).json({ repositoryName: name, tests });
    } catch (error) {
      console.error('Error fetching repository tests:', error);
      res.status(500).json({ error: 'Internal Server Error', details: error.message });
    } finally {
      if (fs.existsSync(localRepositoryDir))
        fs.rmdirSync(localRepositoryDir, { recursive: true });
    }
  });
  
  /**
   * @swagger
   * components:
   *   schemas:
   *     Host:
   *       type: object
   *       required:
   *         - Id
   *         - GridId
   *         - Type
   *         - Status
   *         - Hostname
   *         - Cores
   *         - CreationTimestamp
   *         - LastUpdateTimestamp
   *       properties:
   *         Id:
   *           type: integer
   *         GridId:
   *           type: integer
   *         Type:
   *           type: string
   *         Status:
   *           type: string
   *         Hostname:
   *           type: string
   *         Cores:
   *           type: integer
   *         RAM:
   *           type: integer
   *         CreationTimestamp:
   *           type: string
   *           format: date-time
   *         LastUpdateTimestamp:
   *           type: string
   *           format: date-time
   *     GridWithHosts:
   *       type: object
   *       properties:
   *         Id:
   *           type: integer
   *         Name:
   *           type: string
   *         CreationTimestamp:
   *           type: string
   *           format: date-time
   *         LastUpdateTimestamp:
   *           type: string
   *           format: date-time
   *         Hosts:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/Host'
   */

  module.exports = router;