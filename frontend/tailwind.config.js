export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  safelist: [
    // Connector library dynamic badge colors (from connectionTypes.json)
    "bg-amber-700",
    "bg-black",
    "bg-blue-400","bg-blue-500","bg-blue-600","bg-blue-700","bg-blue-800","bg-blue-900",
    "bg-cyan-500","bg-cyan-600",
    "bg-emerald-600",
    "bg-gray-600","bg-gray-700","bg-gray-800","bg-gray-900",
    "bg-green-500","bg-green-600","bg-green-700","bg-green-800",
    "bg-indigo-400","bg-indigo-500","bg-indigo-600",
    "bg-orange-400","bg-orange-500","bg-orange-600","bg-orange-700",
    "bg-pink-500","bg-pink-600",
    "bg-purple-500","bg-purple-600","bg-purple-700",
    "bg-red-500","bg-red-600","bg-red-700","bg-red-800",
    "bg-sky-500",
    "bg-teal-500","bg-teal-600","bg-teal-700",
    "bg-violet-600","bg-violet-700",
    "bg-yellow-400","bg-yellow-500","bg-yellow-600","bg-yellow-700",
  ],
  theme: {
    extend: {
      colors: {
        navy:   { DEFAULT: "#1e1b4b", light: "#312e81", dark: "#13103a" },
        indigo: { DEFAULT: "#4f46e5", light: "#6366f1", dark: "#4338ca" },
        slate:  { DEFAULT: "#64748b", light: "#94a3b8", lighter: "#f1f5f9" }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
