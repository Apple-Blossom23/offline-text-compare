using System;
namespace TextCompare {
    internal static class PolicyTests {
        static void Expect(bool value) { if (!value) throw new Exception("Policy check failed"); }
        static void Main() {
            Expect(Policy.IsAppUrl(Policy.AppUrl));
            foreach (var url in new [] { "https://example.com/", "file:///C:/Windows/win.ini", "https://textcompare.invalid/index.html?external=1", "https://textcompare.invalid.evil/index.html", "https://textcompare.invalid/other.html", "javascript:alert(1)", null }) Expect(!Policy.IsAppUrl(url));
            Expect(Policy.IsValidReport("<!doctype html><p>测试</p>", "对比报告.html"));
            foreach (var filename in new [] { "../a.html", "C:\\a.html", "a.exe", "a/other.html", "a\0.html", "" }) Expect(!Policy.IsValidReport("<!doctype html>", filename));
            Expect(!Policy.IsValidReport(null, "a.html")); Expect(!Policy.IsValidReport("invalid", "a.html"));
            Console.WriteLine("Desktop policy: origin and report validation passed.");
        }
    }
}
