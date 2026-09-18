cask "markdown-viewer" do
  version "1.4.0"
  sha256 "9972c5edfe3598459f8c80cda4ad293d5b7aac64b1fe255a14aad8163666ef83"

  url "https://github.com/sorenwacker/markdown-viewer/releases/download/v#{version}/markdown-viewer-#{version}-arm64.zip"
  name "Markdown Viewer"
  desc "Cross-platform markdown viewer with mermaid diagram support"
  homepage "https://github.com/sorenwacker/markdown-viewer"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Markdown Viewer.app"

  zap trash: [
    "~/Library/Application Support/markdown-viewer",
    "~/Library/Preferences/com.markdown-viewer.app.plist",
    "~/Library/Saved Application State/com.markdown-viewer.app.savedState",
  ]
end
