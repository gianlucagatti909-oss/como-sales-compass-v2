const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ifiayojxgtrdcefwsynq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaWF5b2p4Z3RyZGNlZndzeW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ4MTcyMiwiZXhwIjoyMDkwMDU3NzIyfQ.rpXB4FJsLimarS397aTAs0fW44K35gNWzHbKTamPS6E'
);

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=it&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ComoSalesCompass/1.0' }
  });
  const data = await response.json();
  if (data.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

async function main() {
  const { data: tps, error } = await supabase
    .from('tp_anagrafica')
    .select('id, indirizzo')
    .is('lat', null);

  if (error) {
    console.log('Errore Supabase:', error.message);
    return;
  }

  console.log('TP da geocodificare: ' + tps.length);

  for (const tp of tps) {
    await new Promise(r => setTimeout(r, 1100));
    const coords = await geocodeAddress(tp.indirizzo);
    if (coords) {
      await supabase
        .from('tp_anagrafica')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('id', tp.id);
      console.log('OK ' + tp.id + ': ' + coords.lat + ', ' + coords.lng);
    } else {
      console.log('NO ' + tp.id + ': non trovato');
    }
  }
  console.log('Fatto!');
}

main();
