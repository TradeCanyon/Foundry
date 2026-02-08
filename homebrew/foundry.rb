cask "foundry" do
  arch arm: "arm64", intel: "x64"

  version "1.7.1"
  sha256 arm:   "ec758b0f4727eea1fb13a7ca4176dbf75baab2f3dc135eacbaa8ce091d27d219",
         intel: "bdb9be0d79f6c7c6c7457f2668dd23ccd0c00a9c7b5a4129960c5d7650190a3a"

  url "https://github.com/Foundry/Foundry/releases/download/v#{version}/Foundry-#{version}-mac-#{arch}.dmg"
  name "Foundry"
  desc "Unified GUI for command-line AI agents"
  homepage "https://github.com/Foundry/Foundry"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :big_sur"

  app "Foundry.app"

  zap trash: [
    "~/Library/Application Support/Foundry",
    "~/Library/Preferences/com.foundry.app.plist",
    "~/Library/Saved Application State/com.foundry.app.savedState",
  ]
end
