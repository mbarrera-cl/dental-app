import type { CreateConsentTemplateProps } from './consent-template.entity.js';

/**
 * Base informed-consent templates shipped with a fresh database. They use
 * `{{paciente}}` and `{{procedimiento}}` placeholders and can be edited from
 * the admin panel afterwards.
 */
export const CONSENT_SEED: readonly CreateConsentTemplateProps[] = [
  {
    key: 'extraccion',
    title: 'Consentimiento informado: extracción dental',
    body: `Yo, {{paciente}}, declaro haber sido informado/a por la profesional tratante sobre la necesidad de realizar {{procedimiento}}.

Se me explicaron los beneficios esperados, los riesgos y complicaciones posibles (dolor, inflamación, sangrado, infección, lesión de estructuras vecinas) y las alternativas de tratamiento, incluida la posibilidad de no tratarme.

Autorizo la realización del procedimiento y el uso de anestesia local. Me comprometo a seguir las indicaciones posteriores y a concurrir a los controles.`,
  },
  {
    key: 'endodoncia',
    title: 'Consentimiento informado: tratamiento de endodoncia',
    body: `Yo, {{paciente}}, autorizo la realización de {{procedimiento}}.

Comprendo que el tratamiento busca conservar la pieza dental, que puede requerir varias sesiones y que, pese a una técnica adecuada, pueden presentarse complicaciones como dolor, fractura de la pieza, infección o necesidad de repetir el procedimiento o de extraer la pieza.

Fui informado/a de las alternativas y de los costos asociados, y acepto continuar con el tratamiento indicado.`,
  },
  {
    key: 'implante',
    title: 'Consentimiento informado: implante dental',
    body: `Yo, {{paciente}}, autorizo la realización de {{procedimiento}} mediante implante dental.

Se me informó que el procedimiento incluye una cirugía, que requiere controles y que su éxito depende de la cicatrización, la higiene y el cumplimiento de las indicaciones. Conozco los riesgos posibles: dolor, inflamación, sangrado, infección, rechazo del implante, lesión de estructuras vecinas y necesidad de procedimientos adicionales.

Acepto el plan de tratamiento propuesto y los controles posteriores.`,
  },
  {
    key: 'cirugia',
    title: 'Consentimiento informado: cirugía oral',
    body: `Yo, {{paciente}}, autorizo a la profesional tratante a realizar {{procedimiento}}.

He recibido información clara sobre el diagnóstico, el procedimiento, la anestesia, los cuidados posteriores y los riesgos y complicaciones posibles (dolor, inflamación, sangrado, infección, alteraciones de la sensibilidad y lesión de estructuras vecinas).

Declaro que mis dudas fueron respondidas y que acepto el procedimiento de forma libre e informada.`,
  },
];
