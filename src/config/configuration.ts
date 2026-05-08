export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/cre_leads',
});
