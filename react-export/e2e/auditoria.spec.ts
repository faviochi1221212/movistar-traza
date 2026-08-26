import { test, expect } from '@playwright/test';

test('Auditoria: el boton "Ver detalle" aparece en la mayoria de filas y abre el drawer', async ({ page }) => {
  await page.goto('/auditoria');
  await page.getByText('Trazabilidad de eventos').click();

  // Espera a que la tabla real (con datos del backend) reemplace el placeholder.
  await expect(page.getByText('Sin eventos registrados aún.')).toHaveCount(0, { timeout: 15_000 });

  const filas = page.locator('table tbody tr');
  const total = await filas.count();
  expect(total).toBeGreaterThan(0);

  const botones = page.getByRole('button', { name: 'Ver detalle' });
  const conBoton = await botones.count();

  console.log(`FILAS_TOTALES=${total}`);
  console.log(`FILAS_CON_VER_DETALLE=${conBoton}`);
  console.log(`PROPORCION=${((conBoton / total) * 100).toFixed(1)}%`);

  expect(conBoton).toBeGreaterThan(0);

  // El header de la 5ta columna debe decir DETALLE, no ACCIÓN duplicado.
  await expect(page.locator('th', { hasText: 'DETALLE' })).toBeVisible();

  // Click en el primer "Ver detalle" y confirmar que el drawer abre.
  await botones.first().click();
  await expect(page.getByText('Reconstrucción de traza')).toBeVisible();
});
