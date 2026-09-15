import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("relay", Path(__file__).with_name("worker.py"))
relay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relay)
SIGNER = "A" * 40
class RelayTests(unittest.TestCase):
    def test_manifest_rejects_version_mismatch(self):
        with self.assertRaises(ValueError):
            relay.validate_manifest({"Version":"1.0.14","Sha256":"B"*64,"Thumbprint":SIGNER}, "agent-v1.0.15",SIGNER)
    def test_manifest_rejects_untrusted_signer(self):
        with self.assertRaises(ValueError):
            relay.validate_manifest({"Version":"1.0.14","Sha256":"B"*64,"Thumbprint":"C"*40}, "agent-v1.0.14",SIGNER)
    def test_manifest_rejects_path_injection(self):
        with self.assertRaises(ValueError):
            relay.validate_manifest({"Version":"../../x","Sha256":"B"*64,"Thumbprint":SIGNER}, "agent-v../../x",SIGNER)
    def test_signature_failure_stops_version_inspection(self):
        with patch.object(relay.subprocess,"run",return_value=subprocess.CompletedProcess([],1)) as run:
            with self.assertRaises(ValueError):
                relay.verify_msi(Path("file.msi"),"1.0.14",SIGNER,"ca.pem")
            self.assertEqual(run.call_count,1)
            self.assertIn("sha1:"+SIGNER,run.call_args.args[0])
    def test_signed_product_version_must_match(self):
        with patch.object(relay.subprocess,"run",side_effect=[
            subprocess.CompletedProcess([],0),
            subprocess.CompletedProcess([],0,stdout="ProductVersion\t1.0.13\n")
        ]):
            with self.assertRaises(ValueError):
                relay.verify_msi(Path("file.msi"),"1.0.14",SIGNER,"ca.pem")
    def test_valid_signature_and_product_version(self):
        with patch.object(relay.subprocess,"run",side_effect=[
            subprocess.CompletedProcess([],0),
            subprocess.CompletedProcess([],0,stdout="ProductVersion\t1.0.14\nProductCode\tTEST\n")
        ]):
            self.assertEqual(relay.verify_msi(Path("file.msi"),"1.0.14",SIGNER,"ca.pem")["ProductCode"],"TEST")
    def test_store_is_idempotent_and_rejects_replacement(self):
        with tempfile.TemporaryDirectory() as d:
            store=Path(d); staging=store/"staging"; staging.mkdir()
            file=staging/"package"; file.write_bytes(b"original")
            sha=relay.digest(file)
            relay.install_package(file,store,"1.0.14",sha,SIGNER,1,{})
            saved=store/"MTI.Alert.Agent.Setup-1.0.14.msi"
            self.assertTrue(Path(str(saved)+".rollout.json").is_file())
            file.write_bytes(b"original")
            relay.install_package(file,store,"1.0.14",sha,SIGNER,1,{})
            file.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                relay.install_package(file,store,"1.0.14",relay.digest(file),SIGNER,1,{})
            self.assertEqual(saved.read_bytes(),b"original")
    def test_draft_and_prerelease_are_ignored(self):
        with patch.object(relay,"fetch") as fetch:
            for item in [{"draft":True},{"prerelease":True},{"tag_name":"unrelated"}]:
                relay.process_release(item,"a/b","secret",Path("."),SIGNER,"ca.pem")
            fetch.assert_not_called()
    def test_download_mismatch_never_verifies_or_installs(self):
        with tempfile.TemporaryDirectory() as d:
            store=Path(d)
            data=json.dumps({"Version":"1.0.14","Sha256":"B"*64,"Thumbprint":SIGNER}).encode()
            release={"id":1,"tag_name":"agent-v1.0.14","assets":[
                {"id":1,"size":3,"name":relay.MSI},
                {"id":2,"size":len(data),"name":relay.MANIFEST}
            ]}
            def fetch(url,token,limit,destination):
                content=data if url.endswith("/2") else b"bad"
                destination.write_bytes(content)
                return len(content)
            with patch.object(relay,"fetch",side_effect=fetch),patch.object(relay,"verify_msi") as verify:
                with self.assertRaises(ValueError):
                    relay.process_release(release,"a/b","secret",store,SIGNER,"ca.pem")
                verify.assert_not_called()
                self.assertFalse(list(store.glob("*.msi")))
            self.assertFalse(list((store/".relay-staging").iterdir()))
    def test_redirect_strips_token_and_rejects_unknown_host(self):
        req=relay.urllib.request.Request("https://api.github.com/example",headers={"Authorization":"Bearer secret"})
        redirected=relay.DownloadRedirect().redirect_request(req,None,302,"",{},"https://release-assets.githubusercontent.com/file")
        self.assertIsNone(redirected.get_header("Authorization"))
        with self.assertRaises(ValueError):
            relay.DownloadRedirect().redirect_request(req,None,302,"",{},"https://untrusted.example/file")
if __name__ == "__main__":
    unittest.main()
