import {
  BaseRecord,
  CreateParams,
  CrudFilter,
  CrudSort,
  DataProvider,
  DeleteOneParams,
  GetListParams,
  GetListResponse,
  GetOneParams,
  UpdateParams,
} from "@refinedev/core";
import { subject } from "@/types";

const mockSubjects: subject[] = [
  {
    id: 1,
    code: "CS101",
    name: "Introduction to Programming",
    department: "CS",
    description:
      "Fundamentals of programming using a modern language, covering variables, control flow, functions, and basic data structures.",
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: 2,
    code: "MATH201",
    name: "Calculus II",
    department: "Math",
    description:
      "A continuation of single-variable calculus, focusing on techniques of integration, sequences, series, and their applications.",
    createdAt: "2026-01-14T09:00:00.000Z",
  },
  {
    id: 3,
    code: "ENG150",
    name: "Academic Writing",
    department: "English",
    description:
      "Develops critical reading and writing skills through analysis, argumentation, and revision of academic essays.",
    createdAt: "2026-01-16T09:00:00.000Z",
  },
];

const applyFilter = (record: subject, filter: CrudFilter): boolean => {
  if (filter.operator === "or") {
    return filter.value.some((subFilter) => applyFilter(record, subFilter));
  }
  if (filter.operator === "and") {
    return filter.value.every((subFilter) => applyFilter(record, subFilter));
  }

  const recordValue = (record as unknown as Record<string, unknown>)[
    (filter as { field: string }).field
  ];

  switch (filter.operator) {
    case "eq":
      return recordValue === filter.value;
    case "ne":
      return recordValue !== filter.value;
    case "contains":
      return String(recordValue)
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    case "ncontains":
      return !String(recordValue)
        .toLowerCase()
        .includes(String(filter.value).toLowerCase());
    default:
      return true;
  }
};

const applySort = (records: subject[], sorters: CrudSort[]): subject[] => {
  if (!sorters.length) return records;

  return [...records].sort((a, b) => {
    for (const sorter of sorters) {
      const aValue = (a as unknown as Record<string, unknown>)[sorter.field];
      const bValue = (b as unknown as Record<string, unknown>)[sorter.field];

      if (aValue === bValue) continue;

      const direction = sorter.order === "asc" ? 1 : -1;
      return aValue! > bValue! ? direction : -direction;
    }
    return 0;
  });
};

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
    filters = [],
    sorters = [],
    pagination,
  }: GetListParams): Promise<GetListResponse<TData>> => {
    if (resource !== "subjects") return { data: [], total: 0 };

    let result = mockSubjects.filter((record) =>
      filters.every((filter) => applyFilter(record, filter)),
    );

    result = applySort(result, sorters);

    const total = result.length;

    if (pagination?.mode !== "off") {
      const currentPage = pagination?.currentPage ?? 1;
      const pageSize = pagination?.pageSize ?? 10;
      const start = (currentPage - 1) * pageSize;
      result = result.slice(start, start + pageSize);
    }

    return {
      data: result as unknown as TData[],
      total,
    };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({
    id,
  }: GetOneParams) => {
    const record = mockSubjects.find(
      (subject) => String(subject.id) === String(id),
    );
    if (!record) throw new Error(`Subject with id ${id} not found`);
    return { data: record as unknown as TData };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({
    variables,
  }: CreateParams<TVariables>) => {
    const newRecord: subject = {
      ...(variables as Omit<subject, "id" | "createdAt">),
      id: Math.max(0, ...mockSubjects.map((subject) => subject.id)) + 1,
      createdAt: new Date().toISOString(),
    };
    mockSubjects.push(newRecord);
    return { data: newRecord as unknown as TData };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({
    id,
    variables,
  }: UpdateParams<TVariables>) => {
    const index = mockSubjects.findIndex(
      (subject) => String(subject.id) === String(id),
    );
    if (index === -1) throw new Error(`Subject with id ${id} not found`);
    mockSubjects[index] = { ...mockSubjects[index], ...variables };
    return { data: mockSubjects[index] as unknown as TData };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({
    id,
  }: DeleteOneParams<TVariables>) => {
    const index = mockSubjects.findIndex(
      (subject) => String(subject.id) === String(id),
    );
    if (index === -1) throw new Error(`Subject with id ${id} not found`);
    const [deleted] = mockSubjects.splice(index, 1);
    return { data: deleted as unknown as TData };
  },

  getApiUrl: () => "",
};