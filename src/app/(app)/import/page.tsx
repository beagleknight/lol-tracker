"use client";

import { useState, useTransition, useCallback } from "react";
import { importCsvData } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  X,
  AlertTriangle,
} from "lucide-react";

interface CsvRow {
  date: string;
  result: string;
  champion: string;
  rune: string;
  matchup: string;
  comments: string;
  reviewed: string;
  reviewNotes: string;
}

// Expected column headers (case-insensitive)
const EXPECTED_HEADERS = [
  "date",
  "result",
  "champion",
  "rune",
  "matchup",
  "comments",
  "reviewed",
  "review notes",
];

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["File is empty."] };
  }

  const headerLine = parseCsvLine(lines[0]);
  const headers = headerLine.map((h) => h.toLowerCase().replace(/[^a-z ]/g, "").trim());

  // Validate headers
  const errors: string[] = [];
  const missingHeaders = EXPECTED_HEADERS.filter(
    (eh) => !headers.some((h) => h === eh || h.replace(/\s+/g, "") === eh.replace(/\s+/g, ""))
  );
  if (missingHeaders.length > 0) {
    errors.push(`Missing columns: ${missingHeaders.join(", ")}`);
    return { rows: [], errors };
  }

  // Map header indices
  const indexOf = (name: string) =>
    headers.findIndex(
      (h) => h === name || h.replace(/\s+/g, "") === name.replace(/\s+/g, "")
    );

  const dateIdx = indexOf("date");
  const resultIdx = indexOf("result");
  const championIdx = indexOf("champion");
  const runeIdx = indexOf("rune");
  const matchupIdx = indexOf("matchup");
  const commentsIdx = indexOf("comments");
  const reviewedIdx = indexOf("reviewed");
  const reviewNotesIdx = indexOf("review notes");

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    // Skip rows that are clearly empty
    if (fields.every((f) => f === "")) continue;

    const row: CsvRow = {
      date: fields[dateIdx] || "",
      result: fields[resultIdx] || "",
      champion: fields[championIdx] || "",
      rune: fields[runeIdx] || "",
      matchup: fields[matchupIdx] || "",
      comments: fields[commentsIdx] || "",
      reviewed: fields[reviewedIdx] || "",
      reviewNotes: fields[reviewNotesIdx] || "",
    };

    // Validate essential fields
    if (!row.date || !row.result || !row.champion) {
      errors.push(
        `Row ${i}: Missing date, result, or champion (got: "${row.date}", "${row.result}", "${row.champion}")`
      );
      continue;
    }

    rows.push(row);
  }

  return { rows, errors };
}

export default function ImportPage() {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    message: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: parsed, errors } = parseCsv(text);
      setRows(parsed);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      handleFile(file);
    } else {
      toast.error("Please drop a .csv file.");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleClear() {
    setRows([]);
    setParseErrors([]);
    setFileName(null);
    setImportResult(null);
  }

  function handleImport() {
    if (rows.length === 0) return;

    startTransition(async () => {
      try {
        const result = await importCsvData(rows);
        setImportResult(result);
        toast.success(result.message);
      } catch {
        toast.error("Import failed. Check your data and try again.");
      }
    });
  }

  const wins = rows.filter(
    (r) =>
      r.result.toLowerCase().includes("victory") ||
      r.result.toLowerCase() === "w"
  ).length;
  const losses = rows.length - wins;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Games</h1>
        <p className="text-muted-foreground">
          Import your existing game data from a CSV spreadsheet.
        </p>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className="border-green-500/50">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">{importResult.message}</p>
              <p className="text-sm text-muted-foreground">
                Your imported games are now visible on the Matches page.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Upload */}
      {!importResult && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Your CSV should have the following columns: Date, Result, Champion,
              Rune, Matchup, Comments, Reviewed, Review Notes.
              <br />
              Dates should be in DD/MM/YYYY or YYYY-MM-DD format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {fileName ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium">{fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {rows.length} game{rows.length !== 1 ? "s" : ""} parsed
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-4"
                    onClick={handleClear}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      Drag and drop your CSV file here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only .csv files are supported
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".csv";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFile(file);
                      };
                      input.click();
                    }}
                  >
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
              Warnings ({parseErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground max-h-40 overflow-y-auto">
              {parseErrors.map((error, i) => (
                <li key={i} className="font-mono text-xs">
                  {error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {rows.length > 0 && !importResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Preview ({rows.length} games)</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <Badge
                    variant="secondary"
                    className="bg-green-500/10 text-green-500"
                  >
                    {wins}W
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-red-500/10 text-red-500"
                  >
                    {losses}L
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Review your data before importing. Imported games will have
                synthetic IDs and won&apos;t include KDA/CS stats.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead className="w-[80px]">Result</TableHead>
                      <TableHead>Champion</TableHead>
                      <TableHead>Rune</TableHead>
                      <TableHead>Matchup</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead className="w-[80px]">Reviewed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const isWin =
                        row.result.toLowerCase().includes("victory") ||
                        row.result.toLowerCase() === "w";
                      const isReviewed =
                        row.reviewed.toLowerCase() === "yes" ||
                        row.reviewed.toLowerCase() === "true" ||
                        row.reviewed === "1";
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">
                            {row.date}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isWin ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {isWin ? "W" : "L"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.champion}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.rune || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.matchup || "-"}
                          </TableCell>
                          <TableCell
                            className="text-sm text-muted-foreground max-w-[200px] truncate"
                            title={row.comments}
                          >
                            {row.comments || "-"}
                          </TableCell>
                          <TableCell>
                            {isReviewed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Import Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {rows.length} game{rows.length !== 1 ? "s" : ""} ready to import.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClear}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import {rows.length} Game{rows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Instructions when no file loaded and no result */}
      {rows.length === 0 && !importResult && parseErrors.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>CSV Format Example</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto">
              {`Date,Result,Champion,Rune,Matchup,Comments,Reviewed,Review Notes
17/01/2026,Victory,Qiyana,Electrocute,Syndra,Great roams,Yes,Good map awareness
18/01/2026,Defeat,Qiyana,Conqueror,Zed,Died too much,No,`}
            </pre>
            <p className="text-xs text-muted-foreground mt-3">
              Dates can be DD/MM/YYYY or YYYY-MM-DD format. Result can be
              Victory/Defeat or W/L. Reviewed can be Yes/No, True/False, or 1/0.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
