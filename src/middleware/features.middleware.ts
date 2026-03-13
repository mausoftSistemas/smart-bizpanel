import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

type ModuleName = 'gps' | 'mp' | 'firma' | 'email';

const moduleFieldMap: Record<ModuleName, keyof NonNullable<Request['tenant']>> = {
  gps: 'moduloGps',
  mp: 'moduloMp',
  firma: 'moduloFirma',
  email: 'moduloEmail',
};

const moduleDisplayName: Record<ModuleName, string> = {
  gps: 'GPS',
  mp: 'Medios de Pago',
  firma: 'Firma Digital',
  email: 'Email',
};

export function requireModule(module: ModuleName) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenant = req.tenant;
    if (!tenant) {
      return next(new ForbiddenError('Tenant no cargado'));
    }

    const field = moduleFieldMap[module];
    if (!tenant[field]) {
      return next(new ForbiddenError(`Módulo ${moduleDisplayName[module]} no habilitado en tu plan`));
    }

    next();
  };
}
