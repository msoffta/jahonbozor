import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileSpreadsheet, Upload, X } from "lucide-react";

import {
    AnimatePresence,
    Button,
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    motion,
    ScrollArea,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@jahonbozor/ui";

import { useImportProducts } from "@/api/products.api";
import { parseProductsCsv } from "@/lib/csv-parser";

import type { CsvParseResult } from "@/lib/csv-parser";

interface ImportDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "preview" | "result";

const PREVIEW_LIMIT = 20;

const stepVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

export function ImportDrawer({ open, onOpenChange }: ImportDrawerProps) {
    const { t } = useTranslation("products");
    const [step, setStep] = useState<Step>("upload");
    const [parsedData, setParsedData] = useState<CsvParseResult | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importProducts = useImportProducts();

    const resetState = useCallback(() => {
        setStep("upload");
        setParsedData(null);
        setIsDragging(false);
        importProducts.reset();
    }, [importProducts]);

    const handleClose = useCallback(
        (open: boolean) => {
            if (!open) resetState();
            onOpenChange(open);
        },
        [onOpenChange, resetState],
    );

    const handleFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const result = parseProductsCsv(text);
            setParsedData(result);
            setStep("preview");
        };
        reader.readAsText(file, "utf-8");
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset input so same file can be re-selected
            e.target.value = "";
        },
        [handleFile],
    );

    const handleImport = useCallback(() => {
        if (!parsedData?.products.length) return;
        importProducts.mutate(parsedData.products, {
            onSuccess: () => setStep("result"),
        });
    }, [parsedData, importProducts]);

    const formatNumber = (n: number) => n.toLocaleString("ru-RU");

    return (
        <Drawer open={open} onOpenChange={handleClose}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{t("import_title")}</DrawerTitle>
                </DrawerHeader>

                <div className="px-4 pb-2">
                    <AnimatePresence mode="wait">
                        {step === "upload" && (
                            <motion.div
                                key="upload"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                            >
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors ${
                                        isDragging
                                            ? "border-primary bg-primary/5"
                                            : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                    }`}
                                >
                                    <Upload className="text-muted-foreground h-10 w-10" />
                                    <p className="text-muted-foreground text-sm">
                                        {t("import_drop_hint")}
                                    </p>
                                    <p className="text-muted-foreground/60 text-xs">
                                        {t("import_supported_formats")}
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={handleFileInput}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === "preview" && parsedData && (
                            <motion.div
                                key="preview"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col gap-3"
                            >
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="text-primary h-5 w-5" />
                                    <span className="text-sm font-medium">
                                        {t("import_preview", { count: parsedData.products.length })}
                                    </span>
                                </div>

                                {parsedData.errors.length > 0 && (
                                    <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                        <X className="h-4 w-4 shrink-0" />
                                        {t("import_errors", { count: parsedData.errors.length })}
                                    </div>
                                )}

                                <ScrollArea className="max-h-[45vh]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[40%]">
                                                    {t("product_name")}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t("product_price")}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t("product_costprice")}
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    {t("product_remaining")}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parsedData.products
                                                .slice(0, PREVIEW_LIMIT)
                                                .map((p, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="truncate font-medium">
                                                            {p.name}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatNumber(p.price)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatNumber(p.costprice)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatNumber(p.remaining)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                    {parsedData.products.length > PREVIEW_LIMIT && (
                                        <p className="text-muted-foreground py-2 text-center text-xs">
                                            ... +{parsedData.products.length - PREVIEW_LIMIT}{" "}
                                            {t("import_more_rows")}
                                        </p>
                                    )}
                                </ScrollArea>
                            </motion.div>
                        )}

                        {step === "result" && importProducts.data && (
                            <motion.div
                                key="result"
                                variants={stepVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex flex-col items-center gap-4 py-6"
                            >
                                <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
                                    <FileSpreadsheet className="text-primary h-8 w-8" />
                                </div>
                                <h3 className="text-lg font-semibold">{t("import_success")}</h3>
                                <div className="text-muted-foreground flex flex-col items-center gap-1 text-sm">
                                    <span>
                                        {t("import_created", {
                                            count: importProducts.data.created,
                                        })}
                                    </span>
                                    <span>
                                        {t("import_updated", {
                                            count: importProducts.data.updated,
                                        })}
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DrawerFooter>
                    {step === "upload" && (
                        <Button variant="outline" onClick={() => handleClose(false)}>
                            {t("common:cancel")}
                        </Button>
                    )}

                    {step === "preview" && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={resetState} className="flex-1">
                                {t("common:cancel")}
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={!parsedData?.products.length || importProducts.isPending}
                                className="flex-1"
                            >
                                {importProducts.isPending
                                    ? t("import_importing")
                                    : t("import_confirm")}
                            </Button>
                        </div>
                    )}

                    {step === "result" && (
                        <Button onClick={() => handleClose(false)}>{t("import_done")}</Button>
                    )}
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
