import {
	Button,
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerFooter,
	Checkbox,
	ScrollArea,
	Input,
	Separator,
	Badge,
	Skeleton,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@jahonbozor/ui";
import type { RoleItem } from "@jahonbozor/schemas/src/roles";
import { PermissionGroups } from "@jahonbozor/schemas";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { 
	Search, 
	Users, 
	ShieldCheck, 
	Key, 
	Package, 
	Layers, 
	ShoppingCart, 
	DollarSign, 
	BarChart3,
	History,
	FileSearch,
} from "lucide-react";

interface EditPermissionsDrawerProps {
	role: RoleItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (roleId: number, permissions: string[]) => Promise<void>;
}

export function EditPermissionsDrawer({
	role,
	open,
	onOpenChange,
	onSave,
}: EditPermissionsDrawerProps) {
	const { t } = useTranslation("settings");
	const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isRendered, setIsRendered] = useState(false);

	// Откладываем тяжелый рендеринг контента до открытия модалки
	useEffect(() => {
		if (open) {
			setSelectedPermissions(role?.permissions || []);
			setSearchQuery("");
			// Небольшая задержка, чтобы анимация Drawer завершилась плавно
			const timer = setTimeout(() => setIsRendered(true), 150);
			return () => clearTimeout(timer);
		} else {
			setIsRendered(false);
		}
	}, [open, role]);

	const handleToggle = (permission: string) => {
		setSelectedPermissions((prev) =>
			prev.includes(permission)
				? prev.filter((p) => p !== permission)
				: [...prev, permission],
		);
	};

	const handleToggleGroup = (groupPermissions: readonly string[]) => {
		const allSelected = groupPermissions.every((p) =>
			selectedPermissions.includes(p),
		);

		if (allSelected) {
			setSelectedPermissions((prev) =>
				prev.filter((p) => !groupPermissions.includes(p)),
			);
		} else {
			setSelectedPermissions((prev) => {
				const newSet = new Set([...prev, ...groupPermissions]);
				return Array.from(newSet);
			});
		}
	};

	const handleSave = async () => {
		if (!role) return;
		setIsSaving(true);
		try {
			await onSave(role.id, selectedPermissions);
		} finally {
			setIsSaving(false);
		}
	};

	const permissionGroups = useMemo(() => [
		{ name: "Users", icon: Users, permissions: PermissionGroups.USERS_ALL },
		{ name: "Staff", icon: ShieldCheck, permissions: PermissionGroups.STAFF_ALL },
		{ name: "Roles", icon: Key, permissions: PermissionGroups.ROLES_ALL },
		{ name: "Products", icon: Package, permissions: PermissionGroups.PRODUCTS_ALL },
		{ name: "Categories", icon: Layers, permissions: PermissionGroups.CATEGORIES_ALL },
		{ name: "Orders", icon: ShoppingCart, permissions: PermissionGroups.ORDERS_ALL },
		{ name: "Expenses", icon: DollarSign, permissions: PermissionGroups.EXPENSES_ALL },
		{ name: "ProductHistory", icon: History, permissions: PermissionGroups.PRODUCT_HISTORY_ALL || [] },
		{ name: "AuditLogs", icon: FileSearch, permissions: PermissionGroups.AUDIT_LOGS_ALL || [] },
		{ name: "Analytics", icon: BarChart3, permissions: PermissionGroups.ANALYTICS_ALL },
	], []);

	const filteredGroups = useMemo(() => {
		if (!searchQuery) return permissionGroups;
		const query = searchQuery.toLowerCase();
		
		return permissionGroups.map(group => {
			const groupName = t(`settings:permission_group_${group.name.toLowerCase()}`).toLowerCase();
			const isGroupNameMatch = groupName.includes(query);

			const filteredPermissions = isGroupNameMatch 
				? group.permissions 
				: group.permissions.filter(p => {
					const dotKey = p.replaceAll(':', '.');
					return t(`settings:perm_${dotKey}.title`).toLowerCase().includes(query) ||
						   t(`settings:perm_${dotKey}.desc`).toLowerCase().includes(query) ||
						   p.toLowerCase().includes(query);
				});

			return {
				...group,
				permissions: filteredPermissions
			};
		}).filter(group => group.permissions.length > 0);
	}, [permissionGroups, searchQuery, t]);

	if (!role) return null;

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent className="max-h-[90vh]">
				<DrawerHeader className="border-b pb-4">
					<div className="flex items-center justify-between">
						<DrawerTitle className="text-xl font-bold">
							{t("edit_permissions_title", { roleName: role.name })}
						</DrawerTitle>
						<Badge variant="secondary" className="px-3 py-1 font-mono">
							{selectedPermissions.length} {t("permissions_selected")}
						</Badge>
					</div>
					<div className="relative mt-4">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={t("search_permissions_placeholder")}
							className="pl-10 h-11 bg-muted/30 border-none focus-visible:ring-1"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				</DrawerHeader>

				<TooltipProvider delayDuration={300}>
					<ScrollArea className="flex-1 px-6">
						{!isRendered ? (
							<div className="space-y-8 py-6">
								{[1, 2, 3].map((i) => (
									<div key={i} className="space-y-4">
										<div className="flex items-center gap-3">
											<Skeleton className="h-10 w-10 rounded-lg" />
											<div className="space-y-2">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-20" />
											</div>
										</div>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
											<Skeleton className="h-14 rounded-xl" />
											<Skeleton className="h-14 rounded-xl" />
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="space-y-8 py-6">
								{filteredGroups.map((group) => {
									const groupPerms = group.permissions;
									const allSelected = groupPerms.length > 0 && groupPerms.every((p) =>
										selectedPermissions.includes(p),
									);
									const Icon = group.icon;

									return (
										<div key={group.name} className="space-y-4">
											<div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
												<div className="p-2 rounded-lg bg-primary/10 text-primary">
													<Icon className="h-5 w-5" />
												</div>
												<div className="flex-1">
													<h3 className="font-bold text-sm">
														{t(`permission_group_${group.name.toLowerCase()}`)}
													</h3>
													<p className="text-xs text-muted-foreground">
														{groupPerms.filter(p => selectedPermissions.includes(p)).length} из {groupPerms.length}
													</p>
												</div>
												<Button 
													variant="ghost" 
													size="sm" 
													className="h-8 text-xs font-medium hover:bg-primary/5 text-primary"
													onClick={() => handleToggleGroup(groupPerms)}
												>
													{allSelected ? t("deselect_all") : t("select_all")}
												</Button>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
												{groupPerms.map((permission) => {
													const isSelected = selectedPermissions.includes(permission);
													const dotKey = permission.replaceAll(':', '.');
													const title = t(`settings:perm_${dotKey}.title`);
													const description = t(`settings:perm_${dotKey}.desc`);

													return (
														<Tooltip key={permission}>
															<TooltipTrigger asChild>
																<label
																	className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all duration-200 ${
																		isSelected 
																			? "border-primary/40 bg-primary/3 shadow-sm" 
																			: "border-transparent hover:bg-muted/50"
																	}`}
																>
																	<div className="mt-0.5">
																		<Checkbox
																			checked={isSelected}
																			onCheckedChange={() => handleToggle(permission)}
																		/>
																	</div>
																	<div className="flex-1 space-y-0.5">
																		<span className={`text-sm font-medium leading-none ${isSelected ? "text-primary" : ""}`}>
																			{title}
																		</span>
																		<p className="text-[10px] text-muted-foreground/60 font-mono">
																			{permission}
																		</p>
																	</div>
																</label>
															</TooltipTrigger>
															<TooltipContent side="top" className="max-w-75 text-xs">
																{description}
															</TooltipContent>
														</Tooltip>
													);
												})}
											</div>
											<Separator className="mt-6 opacity-40" />
										</div>
									);
								})}

								{filteredGroups.length === 0 && (
									<div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
										<Search className="h-10 w-10 mb-4 opacity-10" />
										<p>{t("no_permissions_found")}</p>
									</div>
								)}
							</div>
						)}
					</ScrollArea>
				</TooltipProvider>

				<DrawerFooter className="border-t bg-background/95 backdrop-blur-md">
					<div className="flex gap-3 w-full">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
							className="flex-1 h-11"
						>
							{t("common:cancel")}
						</Button>
						<Button 
							onClick={handleSave} 
							disabled={isSaving} 
							className="flex-1 h-11 shadow-md"
						>
							{isSaving ? t("common:saving") : t("common:save")}
						</Button>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
