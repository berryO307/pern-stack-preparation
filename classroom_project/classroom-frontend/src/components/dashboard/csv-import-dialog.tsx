import { useMemo, useRef, useState } from "react";
import { useCreate, useList } from "@refinedev/core";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { parseCsv } from "@/lib/csv.ts";
import type { Department, Subject, User } from "@/types";

type EntityKey = "departments" | "subjects" | "classes" | "faculty";

type ParsedRow = {
  raw: Record<string, string>;
  values?: Record<string, unknown>;
  error?: string;
  status: "pending" | "success" | "failed";
  resultMessage?: string;
};

type Lookups = {
  departmentByCode: Map<string, Department>;
  subjectByCode: Map<string, Subject>;
  teacherByEmail: Map<string, User>;
};

const ENTITY_LABELS: Record<EntityKey, string> = {
  departments: "Departments",
  subjects: "Subjects",
  classes: "Classes",
  faculty: "Faculty",
};

const ENTITY_RESOURCE: Record<EntityKey, string> = {
  departments: "departments",
  subjects: "subjects",
  classes: "classes",
  faculty: "users",
};

const ENTITY_COLUMNS: Record<EntityKey, string[]> = {
  departments: ["name", "code", "description"],
  subjects: ["name", "code", "departmentCode", "description"],
  classes: ["name", "subjectCode", "teacherEmail", "capacity", "status", "description"],
  faculty: ["name", "email"],
};

function transformRow(
  entity: EntityKey,
  raw: Record<string, string>,
  lookups: Lookups,
): { values?: Record<string, unknown>; error?: string } {
  switch (entity) {
    case "departments": {
      if (!raw.name || !raw.code) return { error: "name and code are required" };
      return { values: { name: raw.name, code: raw.code, description: raw.description || undefined } };
    }
    case "subjects": {
      if (!raw.name || !raw.code || !raw.departmentCode) {
        return { error: "name, code and departmentCode are required" };
      }
      const department = lookups.departmentByCode.get(raw.departmentCode.toUpperCase());
      if (!department) return { error: `No department found with code "${raw.departmentCode}"` };
      return {
        values: {
          name: raw.name,
          code: raw.code,
          departmentId: department.id,
          description: raw.description || undefined,
        },
      };
    }
    case "classes": {
      if (!raw.name || !raw.subjectCode || !raw.teacherEmail) {
        return { error: "name, subjectCode and teacherEmail are required" };
      }
      const subject = lookups.subjectByCode.get(raw.subjectCode.toUpperCase());
      if (!subject) return { error: `No subject found with code "${raw.subjectCode}"` };
      const teacher = lookups.teacherByEmail.get(raw.teacherEmail.toLowerCase());
      if (!teacher) return { error: `No teacher found with email "${raw.teacherEmail}"` };
      const capacity = raw.capacity ? Number(raw.capacity) : undefined;
      if (raw.capacity && (!Number.isFinite(capacity) || (capacity as number) < 0)) {
        return { error: `Invalid capacity "${raw.capacity}"` };
      }
      const status = raw.status || "active";
      if (!["active", "inactive", "archived"].includes(status)) {
        return { error: `Invalid status "${raw.status}"` };
      }
      return {
        values: {
          name: raw.name,
          subjectId: subject.id,
          teacherId: teacher.id,
          capacity,
          status,
          description: raw.description || undefined,
        },
      };
    }
    case "faculty": {
      if (!raw.name || !raw.email) return { error: "name and email are required" };
      return { values: { name: raw.name, email: raw.email, role: "teacher" } };
    }
  }
}

const MAX_ROWS = 1000;

export function CsvImportDialog() {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState<EntityKey>("departments");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: create } = useCreate();

  const { query: departmentsQuery } = useList<Department>({
    resource: "departments",
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open },
  });
  const { query: subjectsQuery } = useList<Subject>({
    resource: "subjects",
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open },
  });
  const { query: teachersQuery } = useList<User>({
    resource: "users",
    filters: [{ field: "role", operator: "eq", value: "teacher" }],
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open },
  });

  const lookups: Lookups = useMemo(
    () => ({
      departmentByCode: new Map(
        (departmentsQuery.data?.data ?? []).map((d) => [d.code.toUpperCase(), d]),
      ),
      subjectByCode: new Map(
        (subjectsQuery.data?.data ?? []).map((s) => [s.code.toUpperCase(), s]),
      ),
      teacherByEmail: new Map(
        (teachersQuery.data?.data ?? []).map((t) => [t.email.toLowerCase(), t]),
      ),
    }),
    [departmentsQuery.data, subjectsQuery.data, teachersQuery.data],
  );

  const lookupsLoading =
    departmentsQuery.isLoading || subjectsQuery.isLoading || teachersQuery.isLoading;

  const resetState = () => {
    setRows([]);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileError("");
    setRows([]);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.length > MAX_ROWS) {
        setFileError(`File contains ${parsed.length} rows but the limit is ${MAX_ROWS}. Please split the file and import in smaller batches.`);
        return;
      }

      const nextRows: ParsedRow[] = parsed.map((raw) => {
        const { values, error } = transformRow(entity, raw, lookups);
        return { raw, values, error, status: "pending" };
      });
      setRows(nextRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read or parse CSV file";
      setFileError(message);
    }
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.length - validCount;

  const handleImport = async () => {
    setIsImporting(true);
    const resource = ENTITY_RESOURCE[entity];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.error) continue;

      try {
        await create({
          resource,
          values: row.values!,
          successNotification: false,
          errorNotification: false,
        });
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "success" } : r)),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create row";
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "failed", resultMessage: message } : r)),
        );
      }
    }

    setIsImporting(false);
  };

  const columns = ENTITY_COLUMNS[entity];
  const doneCount = rows.filter((r) => r.status !== "pending").length;
  const successCount = rows.filter((r) => r.status === "success").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Upload className="size-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Bulk-create departments, subjects, classes or faculty from a CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="import-entity-select" className="text-sm font-medium">
              What are you importing?
            </label>
            <Select
              value={entity}
              onValueChange={(value) => {
                setEntity(value as EntityKey);
                resetState();
              }}
              disabled={isImporting}
            >
              <SelectTrigger id="import-entity-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTITY_LABELS) as EntityKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ENTITY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Expected columns: <code>{columns.join(", ")}</code>
            </p>
          </div>

          <div className="grid gap-2">
            <label htmlFor="import-csv-file" className="text-sm font-medium">
              Choose CSV file
            </label>
            <input
              id="import-csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={lookupsLoading || isImporting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50"
            />
            {fileError && (
              <Alert variant="destructive">
                <AlertTitle>Unable to read file</AlertTitle>
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{rows.length} rows</Badge>
                <Badge variant="outline">{validCount} valid</Badge>
                {errorCount > 0 && <Badge variant="destructive">{errorCount} invalid</Badge>}
                {doneCount > 0 && (
                  <>
                    <Badge className="bg-emerald-600 text-white">{successCount} imported</Badge>
                    {failedCount > 0 && <Badge variant="destructive">{failedCount} failed</Badge>}
                  </>
                )}
              </div>

              <ScrollArea className="h-64 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {columns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {row.status === "success" && (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          )}
                          {(row.status === "failed" || row.error) && (
                            <XCircle className="size-4 text-rose-600" />
                          )}
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell key={col} className="max-w-32 truncate text-xs">
                            {row.raw[col] || "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs text-muted-foreground">
                          {row.error ?? row.resultMessage ?? (row.status === "success" ? "Imported" : "Ready")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {errorCount > 0 && doneCount === 0 && (
                <Alert variant="destructive">
                  <AlertTitle>{errorCount} row(s) will be skipped</AlertTitle>
                  <AlertDescription>
                    Fix the CSV and re-upload, or continue — invalid rows are skipped automatically.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isImporting}>
            {doneCount > 0 && doneCount === validCount ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isImporting || doneCount === validCount}
          >
            {isImporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Import ${validCount} row${validCount === 1 ? "" : "s"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

CsvImportDialog.displayName = "CsvImportDialog";
