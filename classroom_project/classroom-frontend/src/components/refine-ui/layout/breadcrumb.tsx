"use client";

import { Fragment, useMemo } from "react";
import { Home } from "lucide-react";
import {
  matchResourceFromRoute,
  useBreadcrumb,
  useLink,
  useResourceParams,
} from "@refinedev/core";
import {
  BreadcrumbSeparator as ShadcnBreadcrumbSeparator,
  BreadcrumbItem as ShadcnBreadcrumbItem,
  BreadcrumbList as ShadcnBreadcrumbList,
  BreadcrumbPage as ShadcnBreadcrumbPage,
  Breadcrumb as ShadcnBreadcrumb,
} from "@/components/ui/breadcrumb";

type BreadcrumbProps = {
  /**
   * Replaces the final crumb's label - Refine derives it from the current
   * action's internal name (e.g. "Show"), which leaks implementation detail
   * a reader shouldn't need to know. Only the last crumb is ever
   * overridden; it's never a link anyway (ShadcnBreadcrumbPage), so
   * swapping its text doesn't change its behaviour.
   */
  overrideLastLabel?: string;
};

export function Breadcrumb({ overrideLastLabel }: BreadcrumbProps = {}) {
  const Link = useLink();
  const { breadcrumbs } = useBreadcrumb();
  const { resources } = useResourceParams();
  const rootRouteResource = matchResourceFromRoute("/", resources);

  const breadCrumbItems = useMemo(() => {
    const list: {
      key: string;
      href: string;
      Component: React.ReactNode;
    }[] = [];

    list.push({
      key: "breadcrumb-item-home",
      href: rootRouteResource.matchedRoute ?? "/",
      Component: (
        <Link to={rootRouteResource.matchedRoute ?? "/"}>
          {rootRouteResource?.resource?.meta?.icon ?? (
            <Home className="h-4 w-4" />
          )}
        </Link>
      ),
    });

    for (const { label, href } of breadcrumbs) {
      list.push({
        key: `breadcrumb-item-${label}`,
        href: href ?? "",
        Component: href ? <Link to={href}>{label}</Link> : <span>{label}</span>,
      });
    }

    if (overrideLastLabel && list.length > 0) {
      const last = list[list.length - 1]!;
      list[list.length - 1] = { ...last, Component: <span>{overrideLastLabel}</span> };
    }

    return list;
  }, [breadcrumbs, Link, rootRouteResource, overrideLastLabel]);

  return (
    <ShadcnBreadcrumb>
      <ShadcnBreadcrumbList>
        {breadCrumbItems.map((item, index) => {
          if (index === breadCrumbItems.length - 1) {
            return (
              <ShadcnBreadcrumbPage key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbPage>
            );
          }

          return (
            <Fragment key={item.key}>
              <ShadcnBreadcrumbItem key={item.key}>
                {item.Component}
              </ShadcnBreadcrumbItem>
              <ShadcnBreadcrumbSeparator />
            </Fragment>
          );
        })}
      </ShadcnBreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

Breadcrumb.displayName = "Breadcrumb";
