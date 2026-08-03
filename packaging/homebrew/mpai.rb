class Mpai < Formula
  desc "Make Codex and Claude Code sessions multiplayer from the terminal"
  homepage "https://godfaddaai.github.io/multiplayer-ai/"
  url "https://github.com/godfaddaai/multiplayer-ai/releases/download/v0.4.2/multiplayer-ai-0.4.2.tgz"
  sha256 "77964c00ac6b890edcf6e34ab899b4a0914ece1d987c27b8776a5e1d5e9db92e"
  license "MIT"

  depends_on "node@20"

  def install
    system formula_opt_bin("node@20")/"npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/mpai --version").strip
  end
end
