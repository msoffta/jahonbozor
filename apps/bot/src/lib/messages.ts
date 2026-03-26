/** Bot i18n messages — single source of truth for all Telegram reply texts. */
export const botMessages = {
    uz: {
        start: "Assalomu alaykum! Buyurtmalaringiz bo'yicha siz bilan bog'lanishimiz uchun telefon raqamingizni ulashing.",
        startWithPhone: "Assalomu alaykum! Telefon raqamingiz saqlangan. Rahmat!",
        generic: "Iltimos, quyidagi tugma orqali telefon raqamingizni ulashing.",
        genericWithPhone: "Telefon raqamingiz allaqachon saqlangan. Rahmat!",
        shareButton: "📱 Raqamni ulashish",
    },
    ru: {
        start: "Здравствуйте! Поделитесь номером телефона, чтобы мы могли связаться с вами по заказам.",
        startWithPhone: "Здравствуйте! Ваш номер телефона сохранён. Спасибо!",
        generic: "Пожалуйста, поделитесь номером телефона через кнопку ниже.",
        genericWithPhone: "Ваш номер телефона уже сохранён. Спасибо!",
        shareButton: "📱 Поделиться номером",
    },
};

export const contactMessages = {
    uz: {
        processingError: "Kontaktni qayta ishlashda xatolik. Qayta urinib ko'ring.",
        wrongContact: "Iltimos, o'zingizning kontaktingizni ulashing.",
        invalidPhone: "Telefon raqam formati noto'g'ri. Qayta urinib ko'ring.",
        success: "Rahmat! Telefon raqamingiz saqlandi.",
        phoneTaken:
            "Bu raqam boshqa akkauntga biriktirilgan. Qo'llab-quvvatlash xizmatiga murojaat qiling.",
        userNotFound: "Akkauntingiz topilmadi. Avval saytga kiring.",
        alreadyHasPhone: "Telefon raqamingiz allaqachon saqlangan!",
        genericError: "Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
    },
    ru: {
        processingError: "Ошибка обработки контакта. Попробуйте ещё раз.",
        wrongContact: "Пожалуйста, поделитесь своим контактом, а не чужим.",
        invalidPhone: "Неверный формат номера. Попробуйте ещё раз.",
        success: "Спасибо! Ваш номер телефона сохранён.",
        phoneTaken: "Этот номер уже привязан к другому аккаунту. Обратитесь в поддержку.",
        userNotFound: "Аккаунт не найден. Сначала войдите на сайт.",
        alreadyHasPhone: "Ваш номер телефона уже сохранён!",
        genericError: "Произошла ошибка. Попробуйте позже.",
    },
};

export const debtReminderMessages = {
    uz: {
        reminder: (fullname: string, balance: string) =>
            `Hurmatli ${fullname}, sizning qarzdorligingiz: ${balance} so'm. Iltimos, o'z vaqtida to'lang.`,
    },
    ru: {
        reminder: (fullname: string, balance: string) =>
            `Уважаемый(ая) ${fullname}, ваша задолженность: ${balance} сум. Пожалуйста, оплатите вовремя.`,
    },
};
