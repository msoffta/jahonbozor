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
            <Link to={backTo} className="shrink-0 text-foreground active:opacity-70">
                <ArrowLeft className="size-5" />
            </Link>
            {crumbs.map((crumb, i) => (
                <Fragment key={i}>
                    {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                    {crumb.to ? (
                        <Link
                            to={crumb.to}
                            className="truncate text-sm text-muted-foreground active:opacity-70"
                        >
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="truncate text-sm font-semibold text-foreground">
                            {crumb.label}
                        </span>
                    )}
                </Fragment>
            ))}
        </div>
    );
}
