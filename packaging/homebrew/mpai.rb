class Mpai < Formula
  desc "Make Codex and Claude Code sessions multiplayer from the terminal"
  homepage "https://godfaddaai.github.io/multiplayer-ai/"
  url "https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.5/multiplayer-ai-0.4.5.tgz"
  sha256 "24b493d9842fbc3c3022cadebf98678f08732867a42b384fb590ed2c8cf10279"
  license "MIT"

  livecheck do
    url :stable
    strategy :github_latest
  end

  depends_on "node@20"

  def install
    system formula_opt_bin("node@20")/"npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def caveats
    <<~EOS
      Restart the host after upgrades with:
        mpai service install

      Before uninstalling, stop the host with:
        mpai service uninstall
    EOS
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/mpai --version").strip
  end
end
