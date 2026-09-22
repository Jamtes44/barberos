import { Router } from 'express';
import { config } from '../config.js';
import { queryOne } from '../db.js';
import { AppError, asyncHandler } from '../util.js';
import { requireAuth, requireOwner, requireShop } from '../middleware/auth.js';
import {
  activateMembership,
  createWompiCheckout,
  getMembership,
  startTrial,
  verifyWompiSignature,
} from '../membership.js';

const router = Router();
router.use(requireAuth, requireShop);

/** GET /api/membership — estado actual de la membresía de la barbería */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getMembership(req.user!.shopId!));
  }),
);

/** POST /api/membership/trial — activa la prueba gratis de 7 días (idempotente) */
router.post(
  '/trial',
  requireOwner,
  asyncHandler(async (req, res) => {
    await startTrial(req.user!.shopId!);
    res.json(await getMembership(req.user!.shopId!));
  }),
);

/** POST /api/membership/checkout — prepara el cobro de $35.900 (Wompi) */
router.post(
  '/checkout',
  requireOwner,
  asyncHandler(async (req, res) => {
    const shop = await queryOne<{ email: string | null }>(
      `SELECT email FROM users WHERE id = $1`,
      [req.user!.id],
    );
    const checkout = await createWompiCheckout(req.user!.shopId!, shop?.email ?? '');
    if (!checkout.wompi) {
      throw new AppError(
        503,
        'La pasarela de pago aún no está configurada en el servidor (faltan las llaves de Wompi).',
      );
    }
    res.json(checkout);
  }),
);

/**
 * POST /api/membership/webhook — evento de Wompi (transaction.updated APPROVED).
 * Sin autenticación: Wompi firma cada evento; la firma se valida contra el body crudo.
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
    const body = (req.body ?? {}) as {
      event?: string;
      signature?: { properties?: string[]; checksum?: string };
      data?: { transaction?: { status?: string } };
      data_transaction?: { reference?: string; status?: string };
    };
    const event = body.event ?? '';
    const transaction = body.data?.transaction ?? {};

    if (event !== 'transaction.updated' || transaction.status !== 'APPROVED') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    if (!verifyWompiSignature(raw ? raw.toString('utf8') : JSON.stringify(body), body.signature)) {
      throw new AppError(401, 'Firma de evento Wompi inválida');
    }

    // La referencia del cobro es "ref-<shopId>" (Wompi la envía en data_transaction).
    const reference = body.data_transaction?.reference ?? '';
    if (!reference.startsWith('ref-')) {
      console.warn('[membership] webhook sin referencia reconocible, se ignora');
      return res.status(200).json({ ok: true, ignored: true });
    }
    const shopId = reference.slice('ref-'.length);
    await activateMembership(shopId);
    console.log(`[membership] pago aprobado -> membresía activa (${shopId})`);
    res.status(200).json({ ok: true });
  }),
);

/**
 * POST /api/membership/test-pay — simula un pago aprobado para probar el flujo.
 * Solo funciona si TEST_PAYMENT_SECRET está configurado y coincide.
 */
router.post(
  '/test-pay',
  requireOwner,
  asyncHandler(async (req, res) => {
    const secret = (req.body ?? {}).secret as string | undefined;
    const allowed =
      !config.isProduction || (Boolean(config.testPaymentSecret) && secret === config.testPaymentSecret);
    if (!allowed) {
      throw new AppError(403, 'No autorizado para simular pagos');
    }
    await activateMembership(req.user!.shopId!);
    res.json(await getMembership(req.user!.shopId!));
  }),
);

export default router;