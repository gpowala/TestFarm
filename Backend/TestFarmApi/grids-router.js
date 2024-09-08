const { sequelize, Grid, Host } = require('./database');
const express = require('express');
const router = express.Router();

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
 *               - Name
 *               - Type
 *               - Hostname
 *               - Cores
 *             properties:
 *               GridName:
 *                 type: string
 *               Name:
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
router.post('/register-host', async (req, res) => {
    try {
      const { GridName, Name, Type, Hostname, Cores, RAM } = req.body;
  
      let grid = await Grid.findOne({ where: { Name: GridName } });
      if (!grid) {
          grid = await Grid.create({
              Name: GridName,
              CreationTimestamp: new Date(),
              LastUpdateTimestamp: new Date()
          });
      }
  
      const newHost = await Host.create({
        GridId: grid.Id,
        Name: Name,
        Type: Type,
        Status: "Waiting for tests...",
        Hostname: Hostname,
        Cores: Cores,
        RAM: RAM,
        CreationTimestamp: new Date(),
        LastUpdateTimestamp: new Date()
      });
      
      res.status(201).json(newHost);
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
  router.get('/unregister-host', async (req, res) => {
    try {
      const { Id } = req.query;
  
      const host = await Host.findByPk(Id);
      if (!host) {
        return res.status(404).json({ error: 'Host not found' });
      }
  
      const gridId = host.GridId;
  
      await host.destroy();
  
      const remainingHosts = await Host.count({ where: { GridId: gridId } });
  
      if (remainingHosts === 0) {
        await Grid.destroy({ where: { Id: gridId } });
      }
  
      res.status(200).json({ message: 'Host unregistered successfully' });
    } catch (error) {
      console.error('Error unregistering host:', error);
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
  router.put('/update-host-status', async (req, res) => {
    try {
      const { Id, Status } = req.body;
  
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
  router.get('/grids', async (req, res) => {
    try {
      const grids = await Grid.findAll({
        include: [{
          model: Host,
          as: 'Hosts'
        }]
      });
  
      res.status(200).json(grids);
    } catch (error) {
      console.error('Error fetching grids with hosts:', error);
      res.status(500).json({ error: 'Internal Server Error' });
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
   *         - Name
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
   *         Name:
   *           type: string
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