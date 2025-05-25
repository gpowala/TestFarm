const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize'); // Add Sequelize import

const express = require('express');
const router = express.Router();

const { appSettings } = require('./appsettings');
const { ArtifactDefinition, sequelize } = require('./database');
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

router.get('/artifact-definition/:id', async (req, res) => {
  const { id } = req.params;

  try {
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

router.put('/artifact-definition/:id', async (req, res) => {
  const { id } = req.params;
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

router.delete('/artifact-definition/:id', async (req, res) => {
  const { id } = req.params;

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

module.exports = router;
