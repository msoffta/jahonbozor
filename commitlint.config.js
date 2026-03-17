export default {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "scope-enum": [
            2,
            "always",
            ["backend", "bot", "admin", "user", "ui", "schemas", "logger", "utils", "ci", "deps"],
        ],
        "scope-empty": [1, "never"],
        "body-max-line-length": [0, "always", Infinity],
    },
};
