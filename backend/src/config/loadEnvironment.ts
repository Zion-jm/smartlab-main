import dotenv from 'dotenv';
import path from 'node:path';
import { validateEnvironment } from './environment';

// Same path from src/config and dist/config. Provider-injected secrets take priority.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
validateEnvironment(process.env);
