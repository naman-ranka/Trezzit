/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./public/**/*.html", "./public/**/*.js", "./public/*.html"],
    theme: {
        extend: {
            fontFamily: {
                'inter': ['Inter', 'sans-serif'],
            },
            colors: {
                'brand': {
                    50: '#f0f4ff',
                    100: '#e0eaff',
                    500: '#4F46E5',
                    600: '#4338CA',
                    700: '#3730A3',
                }
            }
        },
    },
    plugins: [],
}
