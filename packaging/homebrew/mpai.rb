class Mpai < Formula
  desc "Make Codex and Claude Code sessions multiplayer from the terminal"
  homepage "https://godfaddaai.github.io/multiplayer-ai/"
  url "https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.6/multiplayer-ai-0.4.6.tgz"
  sha256 "b8d7e561b4fd64db7a01b597e8fa42fbdeb24346b520b6627da813da99175b34"
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
      Restart and verify the host after upgrades with:
        mpai service install
        mpai doctor

      Before uninstalling, stop the host with:
        mpai service uninstall
    EOS
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/mpai --version").strip
  end
end
