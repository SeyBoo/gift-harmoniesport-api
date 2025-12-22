import tracer from 'dd-trace';

tracer.init({
  service: 'giftasso-api',
  env: process.env.NODE_ENV,
  version: process.env.npm_package_version,
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
});

export default tracer;