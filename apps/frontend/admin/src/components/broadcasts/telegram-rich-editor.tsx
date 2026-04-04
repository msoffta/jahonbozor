import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
    Bold,
    Code,
    Italic,
    Link as LinkIcon,
    Quote,
    Strikethrough,
    Underline as UnderlineIcon,
} from "lucide-react";

import {
    Button,
    cn,
    Input,
    motion,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Separator,
} from "@jahonbozor/ui";

interface TelegramRichEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

export function TelegramRichEditor({ content, onChange, placeholder }: TelegramRichEditorProps) {
    const { t } = useTranslation("broadcasts");
    const [linkUrl, setLinkUrl] = useState("");
    const [linkOpen, setLinkOpen] = useState(false);

    // Track whether update came from parent or from editor typing
    const isExternalUpdate = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                horizontalRule: false,
            }),
            Underline,
            Link.configure({
                autolink: true,
                openOnClick: false,
                HTMLAttributes: {
                    class: "underline",
                },
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: "min-h-32 px-3 py-2 text-sm focus:outline-none",
                ...(placeholder ? { "data-placeholder": placeholder } : {}),
            },
        },
        onUpdate: ({ editor: e }) => {
            if (!isExternalUpdate.current) {
                onChange(e.getHTML());
            }
        },
    });

    // Sync editor content when parent content changes (e.g. template selection)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            isExternalUpdate.current = true;
            editor.commands.setContent(content);
            isExternalUpdate.current = false;
        }
    }, [content, editor]);

    const handleInsertLink = useCallback(() => {
        if (!editor || !linkUrl) return;

        if (linkUrl) {
            editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
        }

        setLinkUrl("");
        setLinkOpen(false);
    }, [editor, linkUrl]);

    if (!editor) {
        return null;
    }

    const toolbarButtons = [
        {
            key: "bold",
            icon: Bold,
            label: t("editor_bold"),
            action: () => editor.chain().focus().toggleBold().run(),
            isActive: editor.isActive("bold"),
        },
        {
            key: "italic",
            icon: Italic,
            label: t("editor_italic"),
            action: () => editor.chain().focus().toggleItalic().run(),
            isActive: editor.isActive("italic"),
        },
        {
            key: "underline",
            icon: UnderlineIcon,
            label: t("editor_underline"),
            action: () => editor.chain().focus().toggleUnderline().run(),
            isActive: editor.isActive("underline"),
        },
        {
            key: "strikethrough",
            icon: Strikethrough,
            label: t("editor_strikethrough"),
            action: () => editor.chain().focus().toggleStrike().run(),
            isActive: editor.isActive("strike"),
        },
        {
            key: "code",
            icon: Code,
            label: t("editor_code"),
            action: () => editor.chain().focus().toggleCode().run(),
            isActive: editor.isActive("code"),
        },
        {
            key: "quote",
            icon: Quote,
            label: t("editor_quote"),
            action: () => editor.chain().focus().toggleBlockquote().run(),
            isActive: editor.isActive("blockquote"),
        },
    ];

    return (
        <div className="tiptap-editor border-input overflow-hidden rounded-md border">
            <style>{`
                .tiptap-editor .ProseMirror blockquote {
                    border-left: 3px solid var(--color-border);
                    padding-left: 0.75rem;
                    margin: 0.5rem 0;
                    color: var(--color-muted-foreground);
                }
                .tiptap-editor .ProseMirror code {
                    background: var(--color-muted);
                    border-radius: 0.25rem;
                    padding: 0.125rem 0.375rem;
                    font-size: 0.875em;
                    font-family: ui-monospace, monospace;
                }
                .tiptap-editor .ProseMirror pre {
                    background: var(--color-muted);
                    border-radius: 0.375rem;
                    padding: 0.5rem 0.75rem;
                    margin: 0.5rem 0;
                    font-family: ui-monospace, monospace;
                    font-size: 0.875em;
                    overflow-x: auto;
                }
                .tiptap-editor .ProseMirror pre code {
                    background: none;
                    padding: 0;
                }
                .tiptap-editor .ProseMirror a {
                    color: var(--color-primary);
                    text-decoration: underline;
                }
                .tiptap-editor .ProseMirror s {
                    text-decoration: line-through;
                }
                .tiptap-editor .ProseMirror p {
                    margin: 0.25rem 0;
                }
            `}</style>
            <div className="bg-muted/50 flex items-center gap-0.5 border-b px-1 py-1">
                {toolbarButtons.map((btn) => {
                    const Icon = btn.icon;
                    return (
                        <motion.button
                            key={btn.key}
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={btn.action}
                            title={btn.label}
                            className={cn(
                                "rounded p-1.5 transition-colors",
                                btn.isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <Icon className="h-4 w-4" />
                        </motion.button>
                    );
                })}

                <Separator orientation="vertical" className="mx-0.5 h-5" />

                <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                    <PopoverTrigger asChild>
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            title={t("editor_link")}
                            className={cn(
                                "rounded p-1.5 transition-colors",
                                editor.isActive("link")
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <LinkIcon className="h-4 w-4" />
                        </motion.button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                        <div className="flex gap-2">
                            <Input
                                placeholder={t("editor_link_url")}
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleInsertLink();
                                    }
                                }}
                                className="h-8 text-sm"
                                autoFocus
                            />
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleInsertLink}
                                disabled={!linkUrl}
                                className="h-8 shrink-0"
                            >
                                {t("editor_link_insert")}
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}
