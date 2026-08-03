class Mpai < Formula
  desc "Make Codex and Claude Code sessions multiplayer from the terminal"
  homepage "https://godfaddaai.github.io/multiplayer-ai/"
  url "https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.4/multiplayer-ai-0.4.4.tgz"
  sha256 "b809d2210dacc74e05d4b67ddfc60bd787bb2d6b06e0fff390bc7494b37ad385"
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
