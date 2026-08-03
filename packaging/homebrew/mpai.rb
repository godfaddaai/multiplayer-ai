class Mpai < Formula
  desc "Make Codex and Claude Code sessions multiplayer from the terminal"
  homepage "https://godfaddaai.github.io/multiplayer-ai/"
  url "https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.16/multiplayer-ai-0.4.16.tgz"
  sha256 "2e5a464497319166e9f44510ab186f950122a35dad2c1a1b15037e9feb96966b"
  license "MIT"

  livecheck do
    url :stable
    strategy :github_latest
  end

  depends_on "node@22"

  def install
    system formula_opt_bin("node@22")/"npm", "install", *std_npm_args
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
