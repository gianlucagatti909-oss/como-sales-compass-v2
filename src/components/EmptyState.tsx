import { Upload } from "lucide-react";

export default function EmptyState({ onUpload }: { onUpload?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Upload className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-bold">Nessun dato caricato</h2>
        <p className="text-sm text-muted-foreground">
          Carica un file CSV con i dati dei touchpoint per iniziare a visualizzare la dashboard.
          Usa il pulsante "Carica CSV" nella barra laterale.
        </p>
      </div>
    </div>
  );
}
