import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capturer les logs console
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[${msg.type()}] ${text}`);
    consoleLogs.push({ type: msg.type(), text });
  });
  
  page.on('pageerror', err => {
    console.error('[PAGE_ERROR]', err.message);
  });
  
  try {
    console.log('Navigation vers http://localhost:5176/ds/ui_kits/diorama/');
    await page.goto('http://localhost:5176/ds/ui_kits/diorama/', { waitUntil: 'networkidle', timeout: 10000 });
    
    console.log('✅ Page chargée, attente de l\'initialisation...');
    await page.waitForTimeout(3000);
    
    // Prendre un screenshot initial
    await page.screenshot({ path: '/tmp/rompiche-init.png' });
    console.log('📸 Screenshot initial sauvegardé');
    
    // Chercher le select preset
    const presets = await page.locator('select option').allTextContents();
    console.log('Presets disponibles:', presets);
    
    // Tester chaque preset
    const testPresets = ['diorama', 'room', 'courtyard', 'field'];
    for (const preset of testPresets) {
      if (!presets.includes(preset)) continue;
      console.log(`\nTest preset: ${preset}`);
      await page.selectOption('select', preset);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `/tmp/rompiche-${preset}.png` });
      console.log(`✅ ${preset} testé`);
    }
    
    // Rechercher les logs importants
    console.log('\n=== LOGS IMPORTANTS ===');
    const importantLogs = consoleLogs.filter(l => 
      l.text.includes('worklet') || 
      l.text.includes('bank') || 
      l.text.includes('Sector') ||
      l.text.includes('granulator') ||
      l.type === 'error'
    );
    
    if (importantLogs.length === 0) {
      console.log('ℹ️  Aucun log spécifique sur worklet/banks trouvé');
    } else {
      importantLogs.forEach(l => {
        console.log(`[${l.type}] ${l.text}`);
      });
    }
    
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
  
  await browser.close();
  process.exit(0);
})();
