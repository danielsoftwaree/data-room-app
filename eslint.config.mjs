import base from '@repo/lint-config';

const baseConfigs = Array.isArray(base) ? base : [base];

export default [{ ignores: ['**/src/generated/**'] }, ...baseConfigs];
