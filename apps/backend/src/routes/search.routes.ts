import { searchDocUtil } from '@controllers/search.controller';
import { Router } from 'express';
import type { Routes } from '@/types/Routes';

export const searchRouter: Router = Router();

export const searchRoute = '/api/search';

const baseURL = () => `${process.env.BACKEND_URL}${searchRoute}`;

export const getSearchRoutes = () =>
  ({
    doc: {
      urlModel: '/doc',
      url: `${baseURL()}/doc`,
      method: 'GET',
    },
  }) satisfies Routes;

searchRouter.get(getSearchRoutes().doc.urlModel, searchDocUtil);
