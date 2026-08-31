export * from '../../features/filters/filters.model';
// `features/careers/career.model` ya no existe. Declaraba OrientationReport,
// CareerMatch y CareerMetrics, un contrato que su propia cabecera admitia
// haber "INVENTADO a partir de las tarjetas del mockup". No coincidia con el
// backend en casi nada, y lo sustituye `features/reports/report.model`, que
// tiene los dos contratos reales -- la fila y el documento.
export * from '../../features/reports/report.model';
export * from '../../features/chat/chat.model';
export * from './user.model';
