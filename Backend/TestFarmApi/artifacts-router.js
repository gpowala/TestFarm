const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize'); // Add Sequelize import

const express = require('express');
const router = express.Router();

const { appSettings } = require('./appsettings');
const { ArtifactDefinition, Artifact, sequelize } = require('./database');
const { sendTestRunCompletionMessageToTeams } = require('./notifications');

router.post('/artifact-definition', async (req, res) => {
  console.log('Creating artifact definition:', req.body);

  const { Name, InstallScript, Tags } = req.body;

  try {
    let artifactDefinition = await ArtifactDefinition.create({
      Name: Name,
      InstallScript: InstallScript,
      Tags: Tags
    });

    res.status(201).json(artifactDefinition);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.get('/artifact-definition', async (req, res) => {
  const id = req.query.id;

  try {
    if (!id) {
      return res.status(400).json({ error: 'ID parameter is required' });
    }
    
    const artifactDefinition = await ArtifactDefinition.findByPk(id);
    if (!artifactDefinition) {
      return res.status(404).json({ error: 'Artifact definition not found' });
    }
    res.status(200).json(artifactDefinition);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.get('/artifacts-definitions', async (req, res) => {
  try {
    const artifactDefinitions = await ArtifactDefinition.findAll();
    res.status(200).json(artifactDefinitions);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.put('/artifact-definition', async (req, res) => {
  const { id } = req.body;
  const { Name, InstallScript, Tags } = req.body;

  try {
    const artifactDefinition = await ArtifactDefinition.findByPk(id);
    if (!artifactDefinition) {
      return res.status(404).json({ error: 'Artifact definition not found' });
    }

    artifactDefinition.Name = Name;
    artifactDefinition.InstallScript = InstallScript;
    artifactDefinition.Tags = Tags;

    await artifactDefinition.save();
    res.status(200).json(artifactDefinition);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.delete('/artifact-definition', async (req, res) => {
  const { id } = req.body;

  try {
    const artifactDefinition = await ArtifactDefinition.findByPk(id);
    if (!artifactDefinition) {
      return res.status(404).json({ error: 'Artifact definition not found' });
    }

    await artifactDefinition.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.post('/artifact', async (req, res) => {
  const { ArtifactDefinitionName, BuildId, BuildName, Repository, Branch, Revision, WorkItemUrl, BuildPageUrl, Tags } = req.body;

  try {
    const artifactDefinition = await ArtifactDefinition.findOne({ where: { Name: ArtifactDefinitionName } });
    if (!artifactDefinition) {
      return res.status(404).json({ error: 'Artifact definition not found' });
    }

    const artifact = await Artifact.create({
      ArtifactDefinitionId: artifactDefinition.Id,
      BuildId,
      BuildName,
      Repository,
      Branch,
      Revision,
      WorkItemUrl,
      BuildPageUrl,
      Tags,
      CreationTimestamp: new Date()
    });

    res.status(201).json(artifact);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.get('/artifact', async (req, res) => {
  const id = req.query.id;

  try {
    const artifact = await Artifact.findByPk(id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.status(200).json(artifact);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.get('/artifacts', async (req, res) => {
  try {
    const artifacts = await Artifact.findAll();
    res.status(200).json(artifacts);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

router.get('/artifacts-by-definition-id', async (req, res) => {
  const id = req.query.id;

  try {
    const artifacts = await Artifact.findAll({
      where: { ArtifactDefinitionId: id }
    });

    res.status(200).json(artifacts);
  } catch (error) {
    res.status(500).json({ error: `Internal Server Error: ${error}` });
  }
});

module.exports = router;
