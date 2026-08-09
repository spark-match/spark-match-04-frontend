import { UNKNOWN_TOOL_LABEL, toolKind, toolLabel } from './tool-labels';

describe('toolLabel', () => {
  it('says what a web search is in plain words', () => {
    expect(toolLabel('web_search')).toBe('Buscando en internet…');
  });

  it('translates the vocational tools', () => {
    expect(toolLabel('search_careers')).toBe('Consultando el catálogo de carreras…');
    expect(toolLabel('evaluate_riasec_profile')).toBe('Evaluando tu perfil vocacional…');
    expect(toolLabel('calculate_affinity')).toBe('Calculando tu afinidad…');
  });

  it('tells the real catalogue apart from the generic one', () => {
    // Son dos herramientas distintas y hacen cosas distintas: una describe la
    // carrera, la otra dice en qué universidad se estudia y cuánto cuesta.
    expect(toolLabel('search_programs')).toBe('Buscando carreras en universidades e institutos…');
    expect(toolLabel('search_programs')).not.toBe(toolLabel('search_careers'));
  });

  it('has a label for every tool the agent can actually call', () => {
    // El inventario real está en `src/agent/factory.py` del agente, más las
    // que registra deepagents. Este test existe porque `search_programs` se
    // añadió allí y no aquí, y el chip quedó anunciándose como «Usando una
    // herramienta…» en producción sin que fallara nada.
    const inventory = [
      // Propias del agente (`create_deep_agent(tools=[...])`).
      'evaluate_riasec_profile',
      'search_careers',
      'search_programs',
      'calculate_affinity',
      'web_search',
      // De langmem: el nombre que viaja es el de la librería, no el de la
      // variable de Python.
      'manage_memory',
      'search_memory',
      // Registradas por deepagents. `execute` no está: el middleware la
      // filtra antes de cada llamada al modelo, así que nunca llega a viajar.
      'task',
      'write_todos',
      'ls',
      'read_file',
      'write_file',
      'edit_file',
      'glob',
      'grep',
    ];

    const sinEtiqueta = inventory.filter((tool) => toolLabel(tool) === UNKNOWN_TOOL_LABEL);

    expect(sinEtiqueta).toEqual([]);
  });

  it('treats subagent delegation as what it looks like to a student', () => {
    // ag_ui_langgraph no emite eventos de subagente: deepagents expone la
    // delegación como una tool call normal llamada `task`.
    expect(toolLabel('task')).toBe('Consultando a un especialista…');
  });

  it('never leaks the name of a tool it does not know', () => {
    // Mostrar el nombre crudo publicaría el inventario interno de
    // herramientas del agente a cualquiera que abra el chat.
    const label = toolLabel('herramienta_interna_secreta');

    expect(label).toBe(UNKNOWN_TOOL_LABEL);
    expect(label).not.toContain('herramienta_interna_secreta');
  });

  it('handles a missing tool name', () => {
    expect(toolLabel(undefined)).toBe(UNKNOWN_TOOL_LABEL);
    expect(toolLabel('')).toBe(UNKNOWN_TOOL_LABEL);
  });
});

/**
 * Guarda contra la deriva entre el agente y esta pantalla.
 *
 * `recommend_programs` llego con el motor multicriterio y estuvo semanas sin
 * etiqueta: la herramienta que mas trabajo hace se anunciaba como «Usando una
 * herramienta…». El fallo no se nota, que es lo peor que puede tener — no
 * revienta nada, solo empobrece el chat en silencio.
 *
 * La lista se mantiene A MANO porque el frontend no puede leer el `__all__`
 * del agente: son dos repos y dos despliegues. Copiada de
 * `spark-match-08-deep-agent/src/tools/__init__.py`. Si el agente añade una
 * herramienta y nadie toca esto, el test no se entera; lo que sí atrapa es lo
 * contrario, que es el caso que se dio: alguien añade la herramienta a las dos
 * listas y se olvida de la etiqueta.
 */
describe('cobertura de etiquetas frente al agente', () => {
  const HERRAMIENTAS_DEL_AGENTE = [
    'calculate_affinity',
    'evaluate_riasec_profile',
    'recommend_programs',
    'search_careers',
    'search_programs',
    'web_search',
  ];

  it.each(HERRAMIENTAS_DEL_AGENTE)('%s tiene etiqueta propia', (herramienta) => {
    expect(toolLabel(herramienta)).not.toBe(UNKNOWN_TOOL_LABEL);
  });
});

describe('toolKind', () => {
  it('marca la busqueda web como busqueda', () => {
    // Es la unica que sale a internet, y de eso depende cuanto fiarse del dato.
    expect(toolKind('web_search')).toBe('search');
  });

  it('el resto son herramientas normales', () => {
    expect(toolKind('search_careers')).toBe('tool');
    expect(toolKind('recommend_programs')).toBe('tool');
  });

  it('leer el catalogo NO es salir a internet', () => {
    // `search_programs` suena a busqueda y no lo es: lee el CSV del MINEDU que
    // viaja dentro del agente. Confundirlas le diria al estudiante que un dato
    // citable viene de la web de hoy.
    expect(toolKind('search_programs')).toBe('tool');
  });

  it('una herramienta desconocida no se presume de internet', () => {
    expect(toolKind('herramienta_nueva')).toBe('tool');
    expect(toolKind(undefined)).toBe('tool');
  });
});
