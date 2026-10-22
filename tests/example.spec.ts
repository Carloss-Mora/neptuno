import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  test.skip(!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD to run this authenticated browser test.');
  await page.goto('http://192.168.1.12:3000/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByRole('textbox', { name: 'Correo Electrónico' }).click();
  await page.getByRole('textbox', { name: 'Correo Electrónico' }).fill(process.env.TEST_EMAIL ?? '');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(process.env.TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.locator('div').filter({ hasText: 'Estado del sistemaRiego' }).nth(3).click();
  await page.locator('div').filter({ hasText: 'Próximo riegoSin riegos' }).nth(3).click();
  await page.getByRole('button', { name: 'Modificar área' }).click();
  await page.getByRole('spinbutton', { name: 'Área de cultivo (m²)' }).click();
  await page.getByRole('spinbutton', { name: 'Área de cultivo (m²)' }).fill('86');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByText('--%Humedad del Suelo').click();
  await page.getByText('--%Humedad del Suelo').click();
  await page.getByText('--%Nivel de Agua').click();
  await page.getByRole('link', { name: 'Configurar horario', exact: true }).click();
  await page.getByRole('button', { name: 'Activar Riego' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Desactivar Riego' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Nuevo horario' }).click();
  await page.getByRole('button', { name: 'Guardar horario' }).click();
  await page.getByRole('spinbutton', { name: 'Hora de inicio' }).fill('9');
  await page.getByRole('spinbutton', { name: 'Hora de inicio' }).click();
  await page.getByRole('button', { name: 'Periodo de inicio PM' }).click();
  await page.getByRole('spinbutton', { name: 'Minutos de inicio' }).click();
  await page.getByRole('spinbutton', { name: 'Minutos de inicio' }).fill('55');
  await page.getByRole('spinbutton', { name: 'Hora de finalización' }).fill('10');
  await page.getByRole('spinbutton', { name: 'Hora de finalización' }).click();
  await page.getByRole('spinbutton', { name: 'Minutos de finalización' }).click();
  await page.getByRole('spinbutton', { name: 'Minutos de finalización' }).fill('15');
  await page.getByRole('button', { name: 'Periodo de finalización PM' }).click();
  await page.getByRole('button', { name: 'Guardar horario' }).click();
     // Ejecuta la preparación del cartel y el clic de forma simultánea
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog => {
      console.log(`Mensaje emergente: ${dialog.message()}`);
      await dialog.accept(); // Acepta la ventana emergente al instante
    }),
    page.getByRole('button', { name: 'Eliminar' }).click() // Hace clic en el botón
  ]);

  // Espera un instante a que tu base de datos procese el cambio
  await page.waitForTimeout(2000);

  await page.locator('.recharts-layer > .recharts-rectangle').first().click();
  await page.locator('g:nth-child(8) > .recharts-layer.recharts-bar-rectangles > g > g:nth-child(14) > .recharts-rectangle').click();
  await page.getByRole('link', { name: 'Historial de Riego' }).click();
  await page.getByRole('button', { name: 'Mostrar filtros' }).click();
  await page.getByRole('button', { name: 'Todo el tiempo' }).click();
  await page.getByRole('button', { name: 'Últimos 30 días' }).click();
  await page.getByRole('button', { name: 'Últimos 7 días' }).click();
  await page.getByRole('button', { name: 'Notificaciones (2)' }).click();
  await page.getByRole('button').filter({ hasText: /^$/ }).nth(1).click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: /^$/ }).click();
  await page.getByText('Actividad del sistemaHistorial de riegoRevisa cada sesión, cuánto duró y cuándo').click();
  await page.getByText('Registro de ActividadÚltimos').click();
  await page.getByRole('link', { name: 'Inicio', exact: true }).click();
  await page.getByRole('menu', { name: 'CM' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar Sesión' }).click();
  await page.getByRole('button', { name: 'Enviar código de verificación' }).click();
  await page.locator('div').nth(1).click();
});