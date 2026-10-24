import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import type { Catalog } from '../types';
import catalog from '../../../../data/catalog.json';
import { applyInitialTheme } from '../hooks/useTheme';
import { connectContainer } from './sdk';
import '../styles.css';
import './toy.css';

applyInitialTheme();
document.documentElement.dataset.edition = 'toy';
connectContainer();
const root = document.getElementById('root');
if (!root) throw new Error('缺少应用挂载节点');
createRoot(root).render(<StrictMode><App initialCatalog={catalog as Catalog} /></StrictMode>);
