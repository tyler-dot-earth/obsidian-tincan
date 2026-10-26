{
  description = "Obsidian Tincan development shell";

  nixConfig = {
    bash-prompt = "";
    bash-prompt-prefix = "";
    bash-prompt-suffix = "";
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSystem =
        f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
      pnpmVersion = "11.8.0";
    in
    {
      devShells = forEachSystem (
        pkgs:
        let
          nodejs = pkgs.nodejs_latest;
          pnpm = pkgs.writeShellApplication {
            name = "pnpm";
            runtimeInputs = [ nodejs ];
            text = ''
              state_dir="''${XDG_STATE_HOME:-$HOME/.local/state}/corepack"
              mkdir -p "$state_dir"
              export COREPACK_HOME="''${COREPACK_HOME:-$state_dir}"
              export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
              exec "${nodejs}/bin/corepack" pnpm@${pnpmVersion} "$@"
            '';
          };
        in
        {
          default = pkgs.mkShell {
            name = "obsidian-tincan";
            packages = [
              nodejs
              pnpm
              pkgs.lefthook
              pkgs.git
              pkgs.jq
              pkgs.tea
              pkgs.ripgrep
              pkgs.fd
            ];
            shellHook = ''
              repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
              if [ -n "$repo_root" ] && [ -d "$repo_root/.git" ] && [ -d "$repo_root/.githooks" ]; then
                git -C "$repo_root" config core.hooksPath .githooks
              fi
            '';
          };
        }
      );
    };
}
