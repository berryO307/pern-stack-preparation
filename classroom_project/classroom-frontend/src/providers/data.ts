import { createDataProvider, CreateDataProviderOptions } from "@refinedev/rest";
import { CreateResponse, GetOneResponse, ListResponse } from "@/types";
import { BACKEND_BASE_URL } from "@/constants";

if (!BACKEND_BASE_URL) {
  throw new Error("No URL provided");
}

const options: CreateDataProviderOptions = {
  getList: {
    getEndpoint: ({ resource }) => resource,

    buildQueryParams: async ({ resource, pagination, filters, sorters }) => {
      const page = pagination?.currentPage ?? 1;
      const pageSize = pagination?.pageSize ?? 10;

      const params: Record<string, string | number> = { page, limit: pageSize };

      if (
        (resource === "classes" ||
          resource === "departments" ||
          resource === "users") &&
        sorters?.[0]
      ) {
        params.sortField = sorters[0].field;
        params.sortOrder = sorters[0].order;
      }

      filters?.forEach((filter) => {
        const field = "field" in filter ? filter.field : "";

        const value = String(filter.value);

        if (resource === "subjects") {
          if (field === "department") params.department = value;
          if (field === "name" || field === "code") params.search = value;
        }

        if (resource === "users") {
          if (field === "role") params.role = value;
          if (field === "name" || field === "email") params.search = value;
        }

        if (resource === "classes") {
          if (field === "name") params.search = value;
          if (field === "subject") params.subject = value;
          if (field === "teacher") params.teacher = value;
          if (field === "status") params.status = value;
        }

        if (resource === "departments") {
          if (field === "name" || field === "code") params.search = value;
        }

        if (resource === "enrollments") {
          if (field === "classId") params.classId = value;
          if (field === "studentId") params.studentId = value;
        }
      });

      return params;
    },

    mapResponse: async (response) => {
      const payload: ListResponse = await response.clone().json();
      return payload.data ?? [];
    },

    getTotalCount: async (response) => {
      const payload: ListResponse = await response.clone().json();
      return payload.pagination?.total ?? payload.data?.length ?? 0;
    },
  },

  create: {
    getEndpoint: ({ resource }) => resource,

    buildBodyParams: async ({ variables }) => variables,

    mapResponse: async (response) => {
      const json: CreateResponse = await response.json();

      return json.data ?? [];
    },

    transformError: async (response) => {
      const body = await response
        .json<{ error?: string }>()
        .catch(() => ({}) as { error?: string });

      return {
        message: body.error ?? "Failed to create record",
        statusCode: response.status,
      };
    },
  },

  getOne: {
    getEndpoint: ({ resource, id }) => `${resource}/${id}`,

    mapResponse: async (response) => {
      const json: GetOneResponse = await response.json();

      return json.data;
    },
  },

  update: {
    getEndpoint: ({ resource, id }) => `${resource}/${id}`,
    getRequestMethod: () => "put",

    buildBodyParams: async ({ variables }) => variables,

    mapResponse: async (response) => {
      const json: GetOneResponse = await response.json();

      return json.data ?? {};
    },

    transformError: async (response) => {
      const body = await response
        .json<{ error?: string }>()
        .catch(() => ({}) as { error?: string });

      return {
        message: body.error ?? "Failed to update record",
        statusCode: response.status,
      };
    },
  },

  deleteOne: {
    getEndpoint: ({ resource, id }) => `${resource}/${id}`,

    // The backend returns `{ data: { id } }` on delete — return it rather than
    // undefined so callers relying on the mutation result (optimistic UI,
    // onSuccess handlers reading the deleted id) actually get it.
    mapResponse: async (response) => {
      const json: GetOneResponse<Record<string, unknown>> = await response.json();

      return json.data;
    },

    transformError: async (response) => {
      const body = await response
        .json<{ error?: string }>()
        .catch(() => ({}) as { error?: string });

      return {
        message: body.error ?? "Failed to delete record",
        statusCode: response.status,
      };
    },
  },

  custom: {
    mapResponse: async (response) => {
      const json: GetOneResponse = await response.json();

      return json.data ?? {};
    },
  },
};

// `ky` (the fetch wrapper createDataProvider uses under the hood) defaults to
// `credentials: "same-origin"`, so without this every mutation silently drops
// the session cookie on the frontend->backend cross-origin request and 401s
// on any auth-gated route — reads worked and masked this since GET endpoints
// don't require a session.
const { dataProvider } = createDataProvider(BACKEND_BASE_URL, options, {
  credentials: "include",
});

export { dataProvider };
