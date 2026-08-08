import {
  BaseRecord,
  DataProvider,
  GetListParams,
  GetListResponse,
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

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({
    resource,
  }: GetListParams): Promise<GetListResponse<TData>> => {
    if (resource !== "subjects") return { data: [], total: 0 };

    return {
      data: mockSubjects as unknown as TData[],
      total: mockSubjects.length,
    };
  },

  getOne: async () => {
    throw new Error("This function is not present in mock");
  },
  create: async () => {
    throw new Error("This function is not present in mock");
  },
  update: async () => {
    throw new Error("This function is not present in mock");
  },
  deleteOne: async () => {
    throw new Error("This function is not present in mock");
  },

  getApiUrl: () => "",
};
