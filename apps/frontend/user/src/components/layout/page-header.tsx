import { Fragment } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface Crumb {
    label: string;
    to?: string;
}

interface PageHeaderProps {
    crumbs: Crumb[];
}

export function PageHeader({ crumbs }: PageHeaderProps) {
    const backTo = crumbs.find((c) => c.to)?.to ?? "/";

    return (
        <div className="flex items-center gap-1.5 px-4 py-3">
            <Link to={backTo} className="text-foreground shrink-0 active:opacity-70">
                <ArrowLeft className="size-5" />
            </Link>
            {crumbs.map((crumb, i) => (
                <Fragment key={crumb.to ?? crumb.label}>
                    {i > 0 && <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />}
                    {crumb.to ? (
                        <Link
                            to={crumb.to}
                            className="text-muted-foreground truncate text-sm active:opacity-70"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-foreground truncate text-sm font-semibold">
                            {crumb.label}
                        </span>
                    )}
                </Fragment>
            ))}
        </div>
    );
}
