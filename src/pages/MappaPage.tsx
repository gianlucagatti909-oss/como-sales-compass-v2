import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Fix Leaflet default icon broken in Vite (assets not bundled correctly)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface TPMapPoint {
  tpId: string;
  nome: string;
  indirizzo: string;
  rappresentante: string;
  lat: number;
  lng: number;
}

const COMO_CENTER: [number, number] = [45.81, 9.08];

export default function MappaPage() {
  const [points, setPoints] = useState<TPMapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRapp, setFilterRapp] = useState<string>("__all__");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch anagrafica rows that have coordinates
        const { data: anagraficaRows, error: anagraficaError } = await supabase
          .from("tp_anagrafica")
          .select("tp_id, indirizzo, lat, lng")
          .not("lat", "is", null)
          .not("lng", "is", null);

        if (anagraficaError) throw anagraficaError;
        if (!anagraficaRows || anagraficaRows.length === 0) {
          setPoints([]);
          return;
        }

        const tpIds = anagraficaRows.map((r) => r.tp_id);

        // Fetch tp_nome and rappresentante from tp_records (one row per tp_id is enough)
        const { data: recordRows, error: recordsError } = await supabase
          .from("tp_records")
          .select("tp_id, tp_nome, rappresentante")
          .in("tp_id", tpIds);

        if (recordsError) throw recordsError;

        // Build a map tp_id → { nome, rappresentante } (last entry wins, doesn't matter)
        const infoMap = new Map<string, { nome: string; rappresentante: string }>();
        for (const row of recordRows ?? []) {
          infoMap.set(row.tp_id, { nome: row.tp_nome, rappresentante: row.rappresentante });
        }

        const result: TPMapPoint[] = anagraficaRows
          .map((row) => {
            const info = infoMap.get(row.tp_id);
            return {
              tpId: row.tp_id,
              nome: info?.nome ?? row.tp_id,
              indirizzo: row.indirizzo ?? "",
              rappresentante: info?.rappresentante ?? "",
              lat: Number(row.lat),
              lng: Number(row.lng),
            };
          })
          .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

        setPoints(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore caricamento mappa");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const rappresentanti = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => { if (p.rappresentante) set.add(p.rappresentante); });
    return [...set].sort();
  }, [points]);

  const filtered = useMemo(
    () => filterRapp === "__all__" ? points : points.filter((p) => p.rappresentante === filterRapp),
    [points, filterRapp],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Caricamento mappa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 text-center text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Mappa Touchpoint</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} TP visualizzati
          </p>
        </div>
        <Select value={filterRapp} onValueChange={setFilterRapp}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tutti i rappresentanti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i rappresentanti</SelectItem>
            {rappresentanti.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {points.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <p>Nessun touchpoint ha coordinate geografiche.</p>
          <p className="text-sm mt-2">Aggiungi lat/lng ai TP tramite il database per visualizzarli sulla mappa.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
          <MapContainer
            center={COMO_CENTER}
            zoom={10}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((point) => (
              <Marker key={point.tpId} position={[point.lat, point.lng]}>
                <Popup>
                  <div className="space-y-1 text-sm min-w-[160px]">
                    <p className="font-semibold text-base">{point.nome}</p>
                    {point.indirizzo && (
                      <p className="text-gray-600">{point.indirizzo}</p>
                    )}
                    {point.rappresentante && (
                      <p className="text-gray-500">
                        <span className="font-medium">Rapp:</span> {point.rappresentante}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
