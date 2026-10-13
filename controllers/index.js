/**
 * MenuFy Backend Controllers
 * Architecture note: API endpoint request handling and orchestration.
 * Specialized routes in /routes delegate to specialized services in /services.
 */

export const healthCheck = (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MenuFy Multi-Tenant Restaurant Engine',
    version: '3.0.0',
  });
};
