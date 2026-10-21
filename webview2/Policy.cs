using System;
using System.IO;

namespace TextCompare {
    internal static class Policy {
        internal const string AppUrl = "https://textcompare.invalid/index.html";
        internal static bool IsAppUrl(string url) { return String.Equals(url, AppUrl, StringComparison.Ordinal); }
        internal static bool IsValidReport(string html, string filename) {
            if (html == null || html.Length > 32000000 || !html.StartsWith("<!doctype html>", StringComparison.Ordinal)) return false;
            if (String.IsNullOrEmpty(filename) || filename.Length > 120 || filename.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || filename.IndexOf('\\') >= 0 || filename.IndexOf('/') >= 0) return false;
            return filename.EndsWith(".html", StringComparison.OrdinalIgnoreCase);
        }
    }
}
