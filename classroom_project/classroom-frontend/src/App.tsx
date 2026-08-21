import { Authenticated, Refine, GitHubBanner } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";

import { BrowserRouter, Route, Routes, Outlet } from "react-router";
import routerProvider, {
  NavigateToResource,
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router";
import { Login } from "./pages/login";
import { ErrorComponent } from "./components/refine-ui/layout/error-component";
import { Layout } from "./components/refine-ui/layout/layout";
import { Header } from "./components/refine-ui/layout/header";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import "./App.css";
import Dashboard from "@/pages/dashboard.tsx";
import { Building2, BookOpen, ClipboardList, GraduationCap, House, Users } from "lucide-react";
import SubjectsList from "@/pages/subjects/list.tsx";
import SubjectsCreate from "@/pages/subjects/create.tsx";
import ClassesList from "@/pages/classes/list.tsx";
import ClassesCreate from "@/pages/classes/create.tsx";
import ClassesShow from "@/pages/classes/show.tsx";
import DepartmentsList from "@/pages/departments/list.tsx";
import DepartmentsCreate from "@/pages/departments/create.tsx";
import DepartmentsEdit from "@/pages/departments/edit.tsx";
import DepartmentsShow from "@/pages/departments/show.tsx";
import UsersList from "@/pages/users/list.tsx";
import UsersCreate from "@/pages/users/create.tsx";
import UsersEdit from "@/pages/users/edit.tsx";
import UsersShow from "@/pages/users/show.tsx";
import FacultyList from "@/pages/faculty/list.tsx";
import EnrollmentsList from "@/pages/enrollments/list.tsx";
import EnrollmentsCreate from "@/pages/enrollments/create.tsx";
import { dataProvider } from "@/providers/data.ts";
import { authProvider } from "@/providers/auth.ts";

function App() {
  return (
    <BrowserRouter>
      <GitHubBanner />
      <ThemeProvider>
        <DevtoolsProvider>
          <Refine
            dataProvider={dataProvider}
            authProvider={authProvider}
            notificationProvider={useNotificationProvider()}
            routerProvider={routerProvider}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: "fKSq8A-kTepPr-o1XM6J",
            }}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: { label: "Home", icon: <House /> },
              },
              {
                name: "departments",
                list: "/departments",
                create: "/departments/create",
                edit: "/departments/edit/:id",
                show: "/departments/show/:id",
                meta: { label: "Departments", icon: <Building2 /> },
              },
              {
                name: "subjects",
                list: "/subjects",
                create: "/subjects/create",
                meta: { label: "Subjects", icon: <BookOpen /> },
              },
              {
                name: "faculty",
                list: "/faculty",
                meta: { label: "Faculty", icon: <Users /> },
              },
              {
                name: "enrollments",
                list: "/enrollments",
                create: "/enrollments/create",
                meta: { label: "Enrollments", icon: <ClipboardList /> },
              },
              {
                name: "classes",
                list: "/classes",
                create: "/classes/create",
                show: "/classes/show/:id",
                meta: { label: "Classes", icon: <GraduationCap /> },
              },
              {
                name: "users",
                list: "/users",
                create: "/users/create",
                edit: "/users/edit/:id",
                show: "/users/show/:id",
                // Full all-roles user management stays reachable by URL (and
                // linked from Faculty/KPI cards); the sidebar shows Faculty
                // instead so the nav isn't two overlapping "people" entries.
                meta: { label: "Users", icon: <Users />, hide: true },
              },
            ]}
          >
            <Routes>
              <Route
                element={
                  <Authenticated
                    key="authenticated-inner"
                    fallback={<CatchAllNavigate to="/login" />}
                  >
                    <Layout>
                      <Outlet />
                    </Layout>
                  </Authenticated>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="departments">
                  <Route index element={<DepartmentsList />} />
                  <Route path="create" element={<DepartmentsCreate />} />
                  <Route path="edit/:id" element={<DepartmentsEdit />} />
                  <Route path="show/:id" element={<DepartmentsShow />} />
                </Route>
                <Route path="subjects">
                  <Route index element={<SubjectsList />} />
                  <Route path="create" element={<SubjectsCreate />} />
                </Route>
                <Route path="faculty">
                  <Route index element={<FacultyList />} />
                </Route>
                <Route path="enrollments">
                  <Route index element={<EnrollmentsList />} />
                  <Route path="create" element={<EnrollmentsCreate />} />
                </Route>
                <Route path="classes">
                  <Route index element={<ClassesList />} />
                  <Route path="create" element={<ClassesCreate />} />
                  <Route path="show/:id" element={<ClassesShow />} />
                </Route>
                <Route path="users">
                  <Route index element={<UsersList />} />
                  <Route path="create" element={<UsersCreate />} />
                  <Route path="edit/:id" element={<UsersEdit />} />
                  <Route path="show/:id" element={<UsersShow />} />
                </Route>
              </Route>

              <Route
                element={
                  <Authenticated
                    key="authenticated-outer"
                    fallback={<Outlet />}
                  >
                    <NavigateToResource resource="dashboard" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<Login />} />
              </Route>

              <Route
                element={
                  <Authenticated key="authenticated-catch-all">
                    <Layout>
                      <Outlet />
                    </Layout>
                  </Authenticated>
                }
              >
                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>
            <Toaster />
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
          <DevtoolsPanel />
        </DevtoolsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
