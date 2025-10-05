import {
  cancelSubscription,
  getPricing,
  getSubscription,
} from '@controllers/stripe.controller';
import { Router } from 'express';
import type { Routes } from '@/types/Routes';

export const stripeRouter: Router = Router();

export const stripeRoute = '/api/stripe';

const baseURL = () => `${process.env.BACKEND_URL}${stripeRoute}`;

export const getStripeRoutes = () =>
  ({
    getPricing: {
      urlModel: '/pricing',
      url: `${baseURL()}/pricing`,
      method: 'POST',
    },
    createSubscription: {
      urlModel: '/create-subscription',
      url: `${baseURL()}/create-subscription`,
      method: 'POST',
    },
    cancelSubscription: {
      urlModel: '/cancel-subscription',
      url: `${baseURL()}/cancel-subscription`,
      method: 'POST',
    },
  }) satisfies Routes;

stripeRouter.post(getStripeRoutes().getPricing.urlModel, getPricing);

stripeRouter.post(
  getStripeRoutes().createSubscription.urlModel,
  getSubscription
);

stripeRouter.post(
  getStripeRoutes().cancelSubscription.urlModel,
  cancelSubscription
);
