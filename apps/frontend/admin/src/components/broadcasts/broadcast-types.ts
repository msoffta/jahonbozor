export type SendVia = "BOT" | "SESSION";

export interface InlineButton {
    text: string;
    url: string;
}

export interface TemplateItem {
    id: number;
    name: string;
    content: string;
    media?: string | null;
    buttons?: string | null;
}

export interface SessionItem {
    id: number;
    name: string;
    phone: string;
    status: string;
}
