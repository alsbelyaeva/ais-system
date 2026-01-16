import app from './app';
import dotenv from 'dotenv';
dotenv.config();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://192.168.56.104:${PORT}`);
});
